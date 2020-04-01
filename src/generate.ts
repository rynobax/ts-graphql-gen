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
} from "graphql";
import { capitalize, flatMap } from "lodash";

import { Document, SchemaTypeMap } from "./types";
import { computeSchemaTypeMap, findCurrentTypeInMap } from "./typeMap";
import { listIfNecessary, graphqlTypeToTS } from "./print";

export function generateTypesString(
  documents: Document[],
  schemaText: string
): string {
  const typeMap = computeSchemaTypeMap(parse(schemaText));
  const schema = buildSchema(schemaText);
  const result = documents
    .map((doc) => {
      return docToString(doc, typeMap, schema);
    })
    .join(EOL);
  return result;
}

function isFragmentDefinition(
  node: DefinitionNode
): node is FragmentDefinitionNode {
  return node.kind === "FragmentDefinition";
}

interface ThingyError {
  message: string;
}

function docToString(
  document: Document,
  typeMap: SchemaTypeMap,
  schema: GraphQLSchema
): string {
  const { content } = document;
  const documentNode = parse(content);
  const validationErrors = validate(schema, documentNode);
  if (validationErrors.length > 0)
    reportErrors(
      validationErrors.map((e) => Error(`Invalid query: ${e.message}`)),
      document
    );
  const errors: ThingyError[] = [];

  const fragments = documentNode.definitions.filter(isFragmentDefinition);

  const result = documentNode.definitions.map((node) => {
    try {
      const res = topLevelToString(node, typeMap, fragments, []);
      return res;
    } catch (err) {
      errors.push(err);
      return "";
    }
  });

  if (errors.length === 0) return result.join(EOL);
  else return reportErrors(errors, document);
}

function reportErrors(errors: ThingyError[], document: Document) {
  let errorMsg = `Found the following errors when parsing the file '${document.file}'\n`;
  errorMsg += errors.map((e) => `  - ${e.message}`).join("\n");
  console.error(errorMsg);
  process.exit(1);
  return "";
}

function topLevelToString(
  node: DefinitionNode,
  typeMap: SchemaTypeMap,
  fragments: FragmentDefinitionNode[],
  history: string[]
): string {
  switch (node.kind) {
    case "OperationDefinition":
      return operationToString(node, typeMap, fragments, history);
    case "FragmentDefinition":
      // TODO: Maybe write these out someday
      return "";
    default:
      throw Error(`Unimplemented node kind ${node.kind}`);
  }
}

// A query, mutation, or subscription
function operationToString(
  node: OperationDefinitionNode,
  typeMap: SchemaTypeMap,
  fragments: FragmentDefinitionNode[],
  history: string[]
): string {
  if (!node.name) throw Error(`Found a ${node.operation} without a name`);
  const name = node.name.value;
  const suffix = capitalize(node.operation);
  const fullName = name + suffix;

  const selectionText = node.selectionSet.selections
    .map((sel) =>
      selectionToString(sel, typeMap, fragments, [...history, suffix]).join(EOL)
    )
    .join(EOL);

  return `
  type ${fullName} = {
    __typename: "${suffix}";
    ${selectionText}
  }
  `;
}

function selectionToString(
  node: SelectionNode,
  typeMap: SchemaTypeMap,
  fragments: FragmentDefinitionNode[],
  history: string[]
): string[] {
  switch (node.kind) {
    case "Field":
      return [fieldToString(node, typeMap, fragments, history)];
    case "FragmentSpread":
      // With a fragment, we lookup the fragment, then render it's selections
      const fragmentName = node.name.value;
      const fragment = fragments.find((f) => f.name.value === fragmentName);
      if (!fragment)
        throw Error(`Could not find fragment definition ${fragmentName}`);
      return flatMap(
        fragment.selectionSet.selections.map((s) =>
          selectionToString(s, typeMap, fragments, history)
        )
      );
    default:
      throw Error(`Unimplemented selection kind ${node.kind}`);
  }
}

function fieldToString(
  node: FieldNode,
  typeMap: SchemaTypeMap,
  fragments: FragmentDefinitionNode[],
  history: string[]
): string {
  const name = node.name.value;
  const newHistory = [...history, name];
  const currentType = findCurrentTypeInMap(typeMap, newHistory);
  if (node.selectionSet) {
    const selections = flatMap(
      node.selectionSet.selections.map((sel) =>
        selectionToString(sel, typeMap, fragments, newHistory)
      )
    );
    const uniqueSelections = selections.filter((e, i) => {
      const getPrefix = (s: string) => s.trim().slice(0, s.indexOf(":"));
      const prefix = getPrefix(e);
      return selections.findIndex((s) => getPrefix(s) === prefix) === i;
    });
    const selectionText = uniqueSelections.join(EOL);
    const innerText = `{
      __typename: "${currentType.value}";
      ${selectionText}
    }`;
    return `${name}: ${listIfNecessary(currentType, innerText)}`;
  } else {
    return `${name}: ${graphqlTypeToTS(currentType)};`;
  }
}
