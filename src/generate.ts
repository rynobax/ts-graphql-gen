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
  GraphQLError,
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
  computeScalarTypeMap,
} from "./typeMap";
import { treeToString } from "./print";
import { reportParsingErrors, endProcess, printGraphQLError } from "./errors";
import { globalTypesToString } from "./global";
import { nonNull } from "./util";
import { Config } from "./config";

export function generateTypesString(
  documents: Document[],
  schemaText: string,
  config: Config
): string {
  const schemaNodes = parseSchemaOrThrow(schemaText, config.options.schema);
  const objectTypeMap = computeObjectTypeMap(schemaNodes);
  const scalarTypeMap = computeScalarTypeMap(schemaNodes, config);
  const schema = buildSchema(schemaText);
  const nodes = documentsToDefinitionNodes(documents, schema);

  const allFragments = nodes.map((e) => e.node).filter(isFragmentDefinition);

  const result = nodes
    .map(({ node, source }) => {
      const trees = definitionNodeToTrees(
        [node],
        objectTypeMap,
        allFragments,
        source
      );
      return trees
        .filter(nonNull)
        .map((tree) => treeToString(tree, scalarTypeMap, config))
        .join(EOL);
    })
    .join(EOL);

  const globalTypes = globalTypesToString(schemaNodes, scalarTypeMap, config);
  return [globalTypes, result].join(EOL);
}

function parseSchemaOrThrow(schemaText: string, location: string) {
  try {
    const schemaNodes = parse(schemaText);
    return schemaNodes;
  } catch (err) {
    if (err instanceof GraphQLError) {
      printGraphQLError(err, { content: schemaText, file: location }, "schema");
      endProcess();
    }
    throw err;
  }
}

function isFragmentDefinition(
  node: DefinitionNode
): node is FragmentDefinitionNode {
  return node.kind === "FragmentDefinition";
}

interface ParsedDocument {
  node: DefinitionNode;
  source: Document;
}

function documentsToDefinitionNodes(
  documents: Document[],
  schema: GraphQLSchema
): ParsedDocument[] {
  const nodes: ParsedDocument[] = [];
  let hadErrors = false;
  for (const doc of documents) {
    const { definitions, validationErrors } = documentToDefinitionNodes(
      doc,
      schema
    );
    nodes.push(
      ...definitions.map((node) => ({
        node,
        source: doc,
      }))
    );
    if (validationErrors.length > 0) {
      hadErrors = true;
      console.error(`GraphQL validation errors in file ${doc.file}:`);
      validationErrors.forEach((e) => {
        console.error(`  - ${e.message}`);
      });
    }
  }
  if (hadErrors) endProcess();
  return nodes;
}

const IGNORE_THESE_RULES = [
  NoUnusedFragmentsRule,
  NoUnusedVariablesRule,
  KnownDirectivesRule,
  KnownFragmentNamesRule,
];

function documentToDefinitionNodes(doc: Document, schema: GraphQLSchema) {
  const { content } = doc;
  try {
    const documentNode = parse(content);
    // TODO: This throws if there is no Query type.  Should probably catch and rethrow
    const relevantRules = specifiedRules.filter(
      (e) => !IGNORE_THESE_RULES.includes(e)
    );
    const validationErrors = validate(schema, documentNode, relevantRules);
    return { definitions: [...documentNode.definitions], validationErrors };
  } catch (err) {
    if (err instanceof GraphQLError) {
      console.log(err);
      printGraphQLError(err, doc, "GraphQL document");
      endProcess();
    }
    console.error(`Error parsing document "${doc.file}"`);
    console.error(err);
    endProcess();
  }
}

function definitionNodeToTrees(
  nodes: DefinitionNode[],
  objectTypeMap: ObjectTypeInfoMap,
  fragments: FragmentDefinitionNode[],
  document: Document
): Array<OperationPrintTree | null> {
  const errors: string[] = [];

  const result = nodes.map((node) => {
    if (!node.loc) throw Error(`No location for document ${document.file}`);
    // The document might contain multiple operations.  This reduces the document to just
    // the relevant part
    const relevantDocument: Document = {
      file: document.file,
      content: document.content.slice(node.loc.start, node.loc.end),
    };
    try {
      switch (node.kind) {
        case "OperationDefinition":
          return operationToTree(
            node,
            objectTypeMap,
            fragments,
            relevantDocument
          );
        case "FragmentDefinition":
          // These are written out by global.ts
          return fragmentToTree(
            node,
            objectTypeMap,
            fragments,
            relevantDocument
          );
        default:
          throw Error(`Unimplemented node kind ${node.kind}`);
      }
    } catch (err) {
      errors.push(err.message);
      return null;
    }
  });

  if (errors.length === 0) return result;
  else {
    // This will end the process, idk why typescript thinks we need to return
    reportParsingErrors(errors, document.file);
  }
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

  const fragmentsUsed: Set<FragmentDefinitionNode> = new Set();

  const returnTypeTree: PrintTreeLeaf = {
    condition: null,
    fieldName: suffix,
    leafs: flatMap(
      definition.selectionSet.selections.map((node) =>
        nodeToLeafs({
          node,
          objectTypeMap,
          fragments,
          history: {
            root: suffix,
            steps: [],
          },
          condition: null,
          fragmentsUsed,
        })
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
    fragmentNames: Array.from(fragmentsUsed.values()).map((f) => f.name.value),
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

  const fragmentsUsed: Set<FragmentDefinitionNode> = new Set();

  const returnTypeTree: PrintTreeLeaf = fieldToLeaf({
    typeKey: rootTypeName,
    fieldName: name,
    typeSummary: { list: false, nullable: false, value: rootTypeName },
    selectionSet: definition.selectionSet,
    objectTypeMap,
    fragments,
    history: { root: rootTypeName, steps: [] },
    condition: null,
    fragmentsUsed,
  });

  return {
    operationName: name,
    outputTypeName: name + "Fragment",
    rootTypeName: rootTypeName,
    returnTypeTree,
    variablesTypeTree: [],
    inputTypeTree: [],
    document,
    fragmentNames: Array.from(fragmentsUsed.values()).map((f) => f.name.value),
  };
}

interface NodeToLeafParams {
  node: SelectionNode;
  objectTypeMap: ObjectTypeInfoMap;
  fragments: FragmentDefinitionNode[];
  history: History;
  condition: string | null;
  fragmentsUsed: Set<FragmentDefinitionNode>;
}

function nodeToLeafs({
  node,
  objectTypeMap,
  fragments,
  history,
  condition,
  fragmentsUsed,
}: NodeToLeafParams): PrintTreeLeaf[] {
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
          fragmentsUsed,
        }),
      ];
    case "FragmentSpread":
      // With a fragment, we lookup the fragment, then render it's selections
      const fragmentName = node.name.value;
      const fragment = fragments.find((f) => f.name.value === fragmentName);
      if (!fragment)
        throw Error(`Could not find fragment definition ${fragmentName}`);
      fragmentsUsed.add(fragment);
      return flatMap(
        fragment.selectionSet.selections.map((s) =>
          nodeToLeafs({
            node: s,
            objectTypeMap,
            fragments,
            history,
            condition,
            fragmentsUsed,
          })
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
          nodeToLeafs({
            node: s,
            objectTypeMap,
            fragments,
            history,
            condition: newCondition,
            fragmentsUsed,
          })
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
  fragmentsUsed: Set<FragmentDefinitionNode>;
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
  fragmentsUsed,
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
          nodeToLeafs({
            node: TYPENAME,
            objectTypeMap,
            fragments,
            history,
            condition: cond,
            fragmentsUsed,
          })
        ),
        ...selectionSet.selections.map((n) =>
          nodeToLeafs({
            node: n,
            objectTypeMap,
            fragments,
            history,
            condition: null,
            fragmentsUsed,
          })
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
