import {
  DocumentNode,
  DefinitionNode,
  InputObjectTypeDefinitionNode,
  TypeNode,
  ListTypeNode,
  EnumTypeDefinitionNode,
} from "graphql";
import { EOL } from "os";
import { schemaTypeToString } from "./util";
import { SchemaType } from "./types";

function isInputObjectType(
  node: DefinitionNode
): node is InputObjectTypeDefinitionNode {
  return node.kind === "InputObjectTypeDefinition";
}

function isEnumType(node: DefinitionNode): node is EnumTypeDefinitionNode {
  return node.kind === "EnumTypeDefinition";
}

export function globalTypesToString(schema: DocumentNode): string {
  // TODO: Might be nice to print other stuff as well (fragments, types)
  const inputTypes = schema.definitions.filter(isInputObjectType);
  const enumTypes = schema.definitions.filter(isEnumType);
  return [
    ...inputTypes.map(inputTypeToString),
    ...enumTypes.map(enumTypeToString),
  ].join(EOL);
}

function enumTypeToString(node: EnumTypeDefinitionNode): string {
  const name = node.name.value;
  if (!node.values) throw Error(`Enum ${name} has no values!`);
  const value = node.values.map((v) => `"${v.name.value}"`).join(" | ");
  return `export type ${name} = ${value};`;
}

function inputTypeToString(node: InputObjectTypeDefinitionNode): string {
  // It's a scalar
  if (!node.fields) return "";
  const content = node.fields
    .map((f) => {
      const key = f.name.value;
      const value = schemaTypeToString(typeToSchemaType(f.type));
      return `${key}: ${value};`;
    })
    .join(EOL);

  const name = node.name.value;
  return `
  export type ${name} = {
    ${content}
  }`;
}

function typeToSchemaType(node: TypeNode): SchemaType {
  switch (node.kind) {
    case "NonNullType":
      const nnType = node;
      switch (nnType.type.kind) {
        case "NamedType":
          return {
            value: nnType.type.name.value,
            list: false,
            nullable: false,
          };
        case "ListType":
          return listTypeToSchemaType(nnType.type, false);
      }
    case "NamedType":
      return { value: node.name.value, list: false, nullable: true };
    case "ListType":
      return listTypeToSchemaType(node, true);
  }
}

function listTypeToSchemaType(
  node: ListTypeNode,
  nullable: boolean
): SchemaType {
  const listType = node.type;
  switch (listType.kind) {
    case "NamedType":
      return { value: listType.name.value, nullable, list: { nullable: true } };
    case "NonNullType":
      switch (listType.type.kind) {
        case "NamedType":
          return {
            value: listType.type.name.value,
            nullable,
            list: { nullable: false },
          };
        default:
          throw Error(`Unimplemented listType type: ${listType.type.kind}`);
      }
    default:
      throw Error(`Unimplemented list type: ${listType.kind}`);
  }
}
