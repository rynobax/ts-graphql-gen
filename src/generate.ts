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
} from "graphql";
import { capitalize } from "lodash";

import { Document, SchemaTypeMap, SchemaValue } from "./types";
import { computeSchemaTypeMap } from "./typeMap";

export function generateTypesString(documents: Document[], schemaText: string) {
  const typeMap = computeSchemaTypeMap(parse(schemaText));
  const schema = buildSchema(schemaText);
  return documents
    .map((doc) => {
      return docToString(doc, typeMap, schema);
    })
    .join(EOL);
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
      return nodeToString(node, typeMap, []);
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

function nodeToString(
  node: DefinitionNode,
  typeMap: SchemaTypeMap,
  history: string[]
): string {
  switch (node.kind) {
    case "OperationDefinition":
      return operationToString(node, typeMap, history);
    default:
      throw Error(`Unimplemented node kind ${node.kind}`);
  }
}

function operationToString(
  node: OperationDefinitionNode,
  typeMap: SchemaTypeMap,
  history: string[]
): string {
  if (!node.name) throw Error(`Found a ${node.operation} without a name`);
  const name = node.name.value;
  const suffix = capitalize(node.operation);
  const fullName = name + suffix;

  const selectionText = node.selectionSet.selections.map((sel) =>
    selectionToString(sel, typeMap, [...history, suffix])
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
  typeMap: SchemaTypeMap,
  history: string[]
): string {
  switch (node.kind) {
    case "Field":
      return fieldToString(node, typeMap, history);
    default:
      throw Error(`Unimplemented selection kind ${node.kind}`);
  }
}

function fieldToString(
  node: FieldNode,
  typeMap: SchemaTypeMap,
  history: string[]
): string {
  const name = node.name.value;
  const newHistory = [...history, name];
  if (node.selectionSet) {
    const selectionText = node.selectionSet.selections.map((sel) =>
      selectionToString(sel, typeMap, newHistory)
    );
    return `${name}: {
      ${selectionText}
    }`;
  } else {
    return `${name}: ${resolveTSTypeFromMap(typeMap, newHistory)};`;
  }
}

function resolveTSTypeFromMap(typeMap: SchemaTypeMap, history: string[]) {
  let last: SchemaTypeMap[string] | null = null;
  let lastValue: SchemaValue | null = null;
  history.forEach((k) => {
    if (last) {
      lastValue = last[k];
      last = typeMap[lastValue.value];
    } else {
      last = typeMap[k];
    }
  });
  if (!lastValue) throw Error();
  return graphqlTypeToTS(lastValue);
}

function graphqlTypeToTS(v: SchemaValue): string {
  let res = "";
  switch (v.value) {
    case "Boolean":
      res = "boolean";
      break;
    case "Float":
      res = "number";
      break;
    case "ID":
      res = "string";
      break;
    case "Int":
      res = "number";
      break;
    case "String":
      res = "string";
      break;
    default:
      throw Error(`Unknown GraphQL scalar ${v.value}`);
  }

  if (v.nullable) res += " | null";

  if (v.list) {
    res = `Array<${res}>`;
    if (v.list.nullable) res += ` | null`;
  }

  return res;
}
