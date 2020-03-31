import { EOL } from "os";
import {
  parse,
  DefinitionNode,
  OperationDefinitionNode,
  SelectionNode,
  FieldNode,
  validate,
  GraphQLSchema,
} from "graphql";
import { capitalize } from "lodash";

import { Document, SchemaTypeMap } from "./types";

export function generateTypesString(
  documents: Document[],
  typeMap: SchemaTypeMap,
  schema: GraphQLSchema
) {
  return documents.map((doc) => docToString(doc, typeMap, schema)).join(EOL);
}

interface ThingyError {
  message: string;
}

function docToString(
  document: Document,
  typeMap: SchemaTypeMap,
  schema: GraphQLSchema
) {
  const { content } = document;
  const documentNode = parse(content);
  const validationErrors = validate(schema, documentNode);
  if (validationErrors.length > 0)
    reportErrors(
      validationErrors.map((e) => Error(`Invalid query: ${e.message}`)),
      document
    );
  const errors: ThingyError[] = [];
  const result = documentNode.definitions.map((node) => {
    try {
      return nodeToString(node, typeMap);
    } catch (err) {
      errors.push(err);
      return "";
    }
  });

  if (errors.length === 0) return result;
  else reportErrors(errors, document);
}

function reportErrors(errors: ThingyError[], document: Document) {
  let errorMsg = `Found the following errors when parsing the file '${document.file}'\n`;
  errorMsg += errors.map((e) => `  - ${e.message}`).join("\n");
  console.error(errorMsg);
  process.exit(1);
}

function nodeToString(node: DefinitionNode, typeMap: SchemaTypeMap): string {
  switch (node.kind) {
    case "OperationDefinition":
      return operationToString(node, typeMap);
    default:
      throw Error(`Unimplemented node kind ${node.kind}`);
  }
}

function operationToString(
  node: OperationDefinitionNode,
  typeMap: SchemaTypeMap
): string {
  if (!node.name) throw Error(`Found a ${node.operation} without a name`);
  const name = node.name.value;
  const suffix = capitalize(node.operation);
  const fullName = name + suffix;

  const selectionText = node.selectionSet.selections.map((sel) =>
    selectionToString(sel, typeMap)
  );

  return `
  type ${fullName} = {
    __typename: '${suffix}';
    ${selectionText}
  }
  `;
}

function selectionToString(
  node: SelectionNode,
  typeMap: SchemaTypeMap
): string {
  switch (node.kind) {
    case "Field":
      return fieldToString(node, typeMap);
    default:
      throw Error(`Unimplemented selection kind ${node.kind}`);
  }
}

function fieldToString(node: FieldNode, typeMap: SchemaTypeMap): string {
  const name = node.name.value;
  if (node.selectionSet) {
    const selectionText = node.selectionSet.selections.map((sel) =>
      selectionToString(sel, typeMap)
    );
    return `
    ${name}: {
      ${selectionText}
    }
    `;
  } else {
    console.log(node);
    return `${name}: ${resolveTSTypeFromMap(name, typeMap)}`;
  }
}

function resolveTSTypeFromMap(type: string, typeMap: SchemaTypeMap) {
  console.log(type);
  console.log(typeMap);
  return typeMap[type];
}
