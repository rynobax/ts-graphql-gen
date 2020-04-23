import { EOL } from "os";
import {
  parse,
  DefinitionNode,
  OperationDefinitionNode,
  SelectionNode,
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
  SelectionSetNode,
} from "graphql";
import { capitalize, flatMap } from "lodash";

import {
  Document,
  ObjectTypeInfoMap,
  OperationPrintTree,
  PrintTreeLeaf,
  History,
  SchemaTypeSummary,
} from "./types";
import {
  computeObjectTypeMap,
  findTypeSummaryFromMap,
  typeNodeToSchemaValue,
} from "./typeMap";
import { treeToString } from "./print";
import { reportErrors, ErrorWithMessage } from "./errors";
import { globalTypesToString } from "./global";
import { nonNull } from "./util";
import { Config } from "./config";

export function generateTypesString(
  documents: Document[],
  schemaText: string,
  config: Config
): string {
  const schemaNodes = parse(schemaText);
  const typeMap = computeObjectTypeMap(schemaNodes);
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
      return trees
        .filter(nonNull)
        .map((tree) => treeToString(tree, config))
        .join(EOL);
    })
    .join(EOL);

  const globalTypes = globalTypesToString(schemaNodes, config);
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
  objectTypeMap: ObjectTypeInfoMap,
  fragments: FragmentDefinitionNode[],
  document: Document
): Array<OperationPrintTree | null> {
  const errors: ErrorWithMessage[] = [];

  const result = nodes.map((node) => {
    try {
      switch (node.kind) {
        case "OperationDefinition":
          return operationToTree(node, objectTypeMap, fragments, document);
        case "FragmentDefinition":
          // These are written out by global.ts
          return fragmentToTree(node, objectTypeMap, fragments, document);
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
  objectTypeMap: ObjectTypeInfoMap,
  fragments: FragmentDefinitionNode[],
  document: Document
): OperationPrintTree {
  if (!definition.name)
    throw Error(`Found a ${definition.operation} without a name`);
  const name = definition.name.value;
  const suffix = capitalize(definition.operation);

  const returnTypeTree: PrintTreeLeaf = {
    condition: null,
    fieldName: suffix,
    leafs: flatMap(
      definition.selectionSet.selections.map((node) =>
        nodeToLeafs(
          node,
          objectTypeMap,
          fragments,
          {
            root: suffix,
            steps: [],
          },
          null
        )
      )
    ),
    typeSummary: { list: false, nullable: false, value: suffix },
    typesThatImplementThis: null,
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
    operationName: name,
    outputTypeName: name + suffix,
    rootTypeName: suffix,
    returnTypeTree,
    variablesTypeTree,
    inputTypeTree,
    document,
  };
}

function fragmentToTree(
  definition: FragmentDefinitionNode,
  objectTypeMap: ObjectTypeInfoMap,
  fragments: FragmentDefinitionNode[],
  document: Document
): OperationPrintTree {
  if (!definition.name) throw Error(`Found a fragment without a name`);
  const name = definition.name.value;

  const rootTypeName = definition.typeCondition.name.value;

  const returnTypeTree: PrintTreeLeaf = fieldToLeaf({
    typeKey: rootTypeName,
    fieldName: name,
    typeSummary: { list: false, nullable: false, value: rootTypeName },
    selectionSet: definition.selectionSet,
    objectTypeMap,
    fragments,
    history: { root: rootTypeName, steps: [] },
    condition: null,
  });

  return {
    operationName: name,
    outputTypeName: name + "Fragment",
    rootTypeName: rootTypeName,
    returnTypeTree,
    variablesTypeTree: [],
    inputTypeTree: [],
    document,
  };
}

function nodeToLeafs(
  node: SelectionNode,
  objectTypeMap: ObjectTypeInfoMap,
  fragments: FragmentDefinitionNode[],
  history: History,
  condition: string | null
): PrintTreeLeaf[] {
  switch (node.kind) {
    case "Field":
      const typeKey = node.name.value;
      const fieldName = node.alias ? node.alias.value : typeKey;

      const newHistory = condition
        ? { root: condition, steps: [typeKey] }
        : { ...history, steps: [...history.steps, typeKey] };
      const typeSummary = findTypeSummaryFromMap(objectTypeMap, newHistory);
      return [
        fieldToLeaf({
          typeKey,
          fieldName,
          typeSummary,
          selectionSet: node.selectionSet,
          objectTypeMap,
          fragments,
          history: newHistory,
          condition,
        }),
      ];
    case "FragmentSpread":
      // With a fragment, we lookup the fragment, then render it's selections
      const fragmentName = node.name.value;
      const fragment = fragments.find((f) => f.name.value === fragmentName);
      if (!fragment)
        throw Error(`Could not find fragment definition ${fragmentName}`);
      return flatMap(
        fragment.selectionSet.selections.map((s) =>
          nodeToLeafs(s, objectTypeMap, fragments, history, condition)
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
          nodeToLeafs(s, objectTypeMap, fragments, history, newCondition)
        )
      );
  }
}

const TYPENAME: SelectionNode = {
  kind: "Field",
  name: { kind: "Name", value: "__typename" },
};

interface FieldToLeafParams {
  typeKey: string;
  fieldName: string;
  typeSummary: SchemaTypeSummary;
  selectionSet: SelectionSetNode | undefined;
  objectTypeMap: ObjectTypeInfoMap;
  fragments: FragmentDefinitionNode[];
  history: History;
  condition: string | null;
}

function fieldToLeaf({
  typeKey,
  fieldName,
  typeSummary,
  selectionSet,
  objectTypeMap,
  fragments,
  history,
  condition,
}: FieldToLeafParams): PrintTreeLeaf {
  if (selectionSet) {
    // Node is an object
    const childType = objectTypeMap.get(typeSummary.value);
    if (!childType) throw Error(`Missing type information for ${typeKey}`);
    return {
      fieldName: fieldName,
      typeSummary,
      typesThatImplementThis:
        childType.typesThatImplementThis.size > 0
          ? Array.from(childType.typesThatImplementThis)
          : null,
      condition,
      leafs: flatMap([
        ...Array.from(childType.typesThatImplementThis).map((cond) =>
          nodeToLeafs(TYPENAME, objectTypeMap, fragments, history, cond)
        ),
        ...selectionSet.selections.map((n) =>
          nodeToLeafs(n, objectTypeMap, fragments, history, null)
        ),
      ]),
    };
  } else {
    // Node is a scalar
    return {
      fieldName,
      typeSummary,
      typesThatImplementThis: null,
      condition,
      leafs: [],
    };
  }
}

function variableToLeafs(node: VariableDefinitionNode): PrintTreeLeaf {
  const fieldName = node.variable.name.value;
  return {
    condition: null,
    fieldName,
    leafs: [],
    typeSummary: typeNodeToSchemaValue(node.type),
    typesThatImplementThis: null,
  };
}
