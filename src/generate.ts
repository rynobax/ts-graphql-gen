import { EOL } from "os";
import {
  parse,
  DefinitionNode,
  OperationDefinitionNode,
  SelectionNode,
  FieldNode,
  validate,
  GraphQLSchema,
  buildSchema,
  FragmentDefinitionNode,
  VariableDefinitionNode,
} from "graphql";
import { capitalize, flatMap } from "lodash";

import {
  Document,
  SchemaTypeMap,
  OperationPrintTree,
  PrintTreeLeaf,
  History,
} from "./types";
import {
  computeSchemaTypeMap,
  findCurrentTypeInMap,
  typeNodeToSchemaValue,
} from "./typeMap";
import { treeToString } from "./print";
import { reportErrors, ErrorWithMessage } from "./errors";
import { globalTypesToString } from "./global";

function nonNull<T>(e: T | null): e is T {
  return e !== null;
}

export function generateTypesString(
  documents: Document[],
  schemaText: string
): string {
  const schemaNodes = parse(schemaText);
  const typeMap = computeSchemaTypeMap(schemaNodes);
  const schema = buildSchema(schemaText);
  const globalTypes = globalTypesToString(schemaNodes);
  const result = documents
    .map((doc) => {
      const trees = docToTrees(doc, typeMap, schema);
      return trees.filter(nonNull).map(treeToString).join(EOL);
    })
    .join(EOL);
  return [globalTypes, result].join(EOL);
}

function isFragmentDefinition(
  node: DefinitionNode
): node is FragmentDefinitionNode {
  return node.kind === "FragmentDefinition";
}

function docToTrees(
  document: Document,
  typeMap: SchemaTypeMap,
  schema: GraphQLSchema
): Array<OperationPrintTree | null> {
  const { content } = document;
  const documentNode = parse(content);
  const validationErrors = validate(schema, documentNode);
  if (validationErrors.length > 0)
    reportErrors(
      validationErrors.map((e) => Error(`Invalid query: ${e.message}`)),
      document
    );
  const errors: ErrorWithMessage[] = [];

  const fragments = documentNode.definitions.filter(isFragmentDefinition);

  const result = documentNode.definitions.map((node) => {
    try {
      switch (node.kind) {
        case "OperationDefinition":
          return operationToTree(node, typeMap, fragments);
        case "FragmentDefinition":
          // TODO: Maybe write these out someday
          return null;
        default:
          throw Error(`Unimplemented node kind ${node.kind}`);
      }
    } catch (err) {
      errors.push(err);
      return null;
    }
  });

  if (errors.length === 0) return result;
  else return reportErrors(errors, document);
}

// A query, mutation, or subscription
function operationToTree(
  node: OperationDefinitionNode,
  typeMap: SchemaTypeMap,
  fragments: FragmentDefinitionNode[]
): OperationPrintTree {
  if (!node.name) throw Error(`Found a ${node.operation} without a name`);
  const name = node.name.value;
  const suffix = capitalize(node.operation);

  const returnTypeTree = flatMap(
    node.selectionSet.selections.map((node) =>
      nodeToLeafs(
        node,
        typeMap,
        fragments,
        {
          root: suffix,
          steps: [],
        },
        null
      )
    )
  );

  const variablesTypeTree = node.variableDefinitions
    ? flatMap(node.variableDefinitions.map((node) => variableToLeafs(node)))
    : [];

  const inputTypeTree = node.variableDefinitions
    ? flatMap(node.variableDefinitions.map((node) => variableToLeafs(node)))
    : [];

  return {
    name,
    operationType: suffix,
    returnTypeTree,
    variablesTypeTree,
    inputTypeTree,
  };
}

function nodeToLeafs(
  node: SelectionNode,
  typeMap: SchemaTypeMap,
  fragments: FragmentDefinitionNode[],
  history: History,
  condition: string | null
): PrintTreeLeaf[] {
  switch (node.kind) {
    case "Field":
      return [fieldToLeaf(node, typeMap, fragments, history, condition)];
    case "FragmentSpread":
      // With a fragment, we lookup the fragment, then render it's selections
      const fragmentName = node.name.value;
      const fragment = fragments.find((f) => f.name.value === fragmentName);
      if (!fragment)
        throw Error(`Could not find fragment definition ${fragmentName}`);
      return flatMap(
        fragment.selectionSet.selections.map((s) =>
          nodeToLeafs(s, typeMap, fragments, history, condition)
        )
      );
    case "InlineFragment":
      // An inline fragment is for an interface or union
      // They are conditional
      if (!node.typeCondition)
        throw Error("Inline fragment with no typeCondition");
      const newCondition = node.typeCondition.name.value;
      return flatMap(
        node.selectionSet.selections.map((s) =>
          nodeToLeafs(s, typeMap, fragments, history, newCondition)
        )
      );
  }
}

const TYPENAME: SelectionNode = {
  kind: "Field",
  name: { kind: "Name", value: "__typename" },
};

function fieldToLeaf(
  node: FieldNode,
  typeMap: SchemaTypeMap,
  fragments: FragmentDefinitionNode[],
  history: History,
  condition: string | null
): PrintTreeLeaf {
  const field = node.name.value;
  const key = node.alias ? node.alias.value : field;

  const newHistory = condition
    ? { root: condition, steps: [field] }
    : { ...history, steps: [...history.steps, field] };
  const currentType = findCurrentTypeInMap(typeMap, newHistory);
  if (node.selectionSet) {
    const typeInfo = typeMap.returnTypes.get(currentType.value);
    if (!typeInfo) throw Error(`Missing typeInfo for ${field}`);
    // Node is an object type, and will have children leafs
    return {
      key,
      type: currentType,
      typeInfo,
      condition,
      leafs: flatMap([
        // Insert typename at top
        ...Array.from(typeInfo.typesThatImplementThis).map((cond) =>
          nodeToLeafs(TYPENAME, typeMap, fragments, newHistory, cond)
        ),
        ...node.selectionSet.selections.map((n) =>
          nodeToLeafs(n, typeMap, fragments, newHistory, null)
        ),
      ]),
    };
  } else {
    // Node is a scalar
    return {
      key,
      type: currentType,
      typeInfo: null,
      condition,
      leafs: [],
    };
  }
}

function variableToLeafs(node: VariableDefinitionNode): PrintTreeLeaf {
  const key = node.variable.name.value;
  return {
    condition: null,
    key,
    leafs: [],
    type: typeNodeToSchemaValue(node.type),
    // TODO: Might need to set this
    typeInfo: null,
  };
}
