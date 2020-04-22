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
  specifiedRules,
  NoUnusedFragmentsRule,
  NoUnusedVariablesRule,
  KnownDirectivesRule,
  KnownFragmentNamesRule,
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
  const nodes = documents.map((doc) => documentToDefinitionNodes(doc, schema));

  const allFragments = flatMap(
    nodes.map((defs) => defs.filter(isFragmentDefinition))
  );

  const result = nodes
    .map((defs, i) => {
      const trees = definitionNodeToTrees(
        defs,
        typeMap,
        allFragments,
        documents[i]
      );
      return trees.filter(nonNull).map(treeToString).join(EOL);
    })
    .join(EOL);

  const globalTypes = globalTypesToString(schemaNodes);
  return [globalTypes, result].join(EOL);
}

function isFragmentDefinition(
  node: DefinitionNode
): node is FragmentDefinitionNode {
  return node.kind === "FragmentDefinition";
}

const IGNORE_THESE_RULES = [
  NoUnusedFragmentsRule,
  NoUnusedVariablesRule,
  KnownDirectivesRule,
  KnownFragmentNamesRule,
];

function documentToDefinitionNodes(
  document: Document,
  schema: GraphQLSchema
): readonly DefinitionNode[] {
  const { content, file } = document;
  const documentNode = parse(content);
  // TODO: This throws if there is no Query type.  Should probably catch and rethrow
  const relevantRules = specifiedRules.filter(
    (e) => !IGNORE_THESE_RULES.includes(e)
  );
  const validationErrors = validate(schema, documentNode, relevantRules);
  if (validationErrors.length > 0)
    reportErrors(
      validationErrors.map((e) =>
        Error(`GraphQL validation error in file ${file}: ${e.message}`)
      ),
      document
    );

  return documentNode.definitions;
}

function definitionNodeToTrees(
  nodes: readonly DefinitionNode[],
  typeMap: SchemaTypeMap,
  fragments: FragmentDefinitionNode[],
  // TODO: Passing this in feels sus, maybe change in error update
  document: Document
): Array<OperationPrintTree | null> {
  const errors: ErrorWithMessage[] = [];

  const result = nodes.map((node) => {
    try {
      switch (node.kind) {
        case "OperationDefinition":
          return operationToTree(node, typeMap, fragments);
        case "FragmentDefinition":
          // These are written out by global.ts
          return fragmentToTree(node, typeMap, fragments);
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

function operationToTree(
  definition: OperationDefinitionNode,
  typeMap: SchemaTypeMap,
  fragments: FragmentDefinitionNode[]
): OperationPrintTree {
  if (!definition.name)
    throw Error(`Found a ${definition.operation} without a name`);
  const name = definition.name.value;
  const suffix = capitalize(definition.operation);

  const returnTypeTree: PrintTreeLeaf = {
    condition: null,
    key: suffix,
    leafs: flatMap(
      definition.selectionSet.selections.map((node) =>
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
    ),
    type: { list: false, nullable: false, value: suffix },
    typeInfo: null,
  };

  const variablesTypeTree = definition.variableDefinitions
    ? flatMap(
        definition.variableDefinitions.map((node) => variableToLeafs(node))
      )
    : [];

  const inputTypeTree = definition.variableDefinitions
    ? flatMap(
        definition.variableDefinitions.map((node) => variableToLeafs(node))
      )
    : [];

  return {
    name,
    suffix: suffix,
    rootTypeName: suffix,
    returnTypeTree,
    variablesTypeTree,
    inputTypeTree,
  };
}

function fragmentToTree(
  definition: FragmentDefinitionNode,
  typeMap: SchemaTypeMap,
  fragments: FragmentDefinitionNode[]
): OperationPrintTree {
  if (!definition.name) throw Error(`Found a fragment without a name`);
  const name = definition.name.value;

  const rootTypeName = definition.typeCondition.name.value;

  const returnTypeTree = flatMap(
    definition.selectionSet.selections.map((node) =>
      nodeToLeafs(
        node,
        typeMap,
        fragments,
        {
          root: rootTypeName,
          steps: [],
        },
        null
      )
    )
  );

  // TODO: Dunno if fragments can have variables
  const variablesTypeTree = definition.variableDefinitions
    ? flatMap(
        definition.variableDefinitions.map((node) => variableToLeafs(node))
      )
    : [];

  // TODO: Dunno if fragments can have inputs
  const inputTypeTree = definition.variableDefinitions
    ? flatMap(
        definition.variableDefinitions.map((node) => variableToLeafs(node))
      )
    : [];

  return {
    name,
    suffix: "Fragment",
    rootTypeName: rootTypeName,
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
