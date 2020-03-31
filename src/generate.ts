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

function nodeToString(node: DefinitionNode, schema: SchemaTypeMap): string {
  switch (node.kind) {
    case "OperationDefinition":
      return operationToString(node, schema);
    default:
      throw Error(`Unimplemented node kind ${node.kind}`);
  }
}

function operationToString(
  node: OperationDefinitionNode,
  schema: SchemaTypeMap
): string {
  if (!node.name) throw Error(`Found a ${node.operation} without a name`);
  const name = node.name.value;
  const suffix = capitalize(node.operation);
  const fullName = name + suffix;

  const selectionText = node.selectionSet.selections.map((sel) =>
    selectionToString(sel, schema)
  );

  return `
  type ${fullName} = {
    __typename: '${suffix}';
    ${selectionText}
  }
  `;
}

function selectionToString(node: SelectionNode, schema: SchemaTypeMap): string {
  switch (node.kind) {
    case "Field":
      return fieldToString(node, schema);
    default:
      throw Error(`Unimplemented selection kind ${node.kind}`);
  }
}

function fieldToString(node: FieldNode, schema: SchemaTypeMap): string {
  const name = node.name.value;
  // console.log(node);
  if (node.selectionSet) {
    const selectionText = node.selectionSet.selections.map((sel) =>
      selectionToString(sel, schema)
    );
    return `
    ${name}: {
      ${selectionText}
    }
    `;
  } else {
    console.log(node);
    // console.log(schema.getType('Query'));
    // console.log(schema.getTypeMap());
    // visit(schema.astNode!, {
    //   enter(node) {
    //     console.log(node);
    //   }
    // })
    // console.log(schema);
    // console.log(schema.extensionASTNodes?.map(e => print(e)))
    throw Error("What to do with no selectionset");
  }
}
