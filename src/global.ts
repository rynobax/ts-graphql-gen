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
import { SchemaTypeSummary, ScalarTypeInfoMap } from "./types";
import { Config } from "./config";

function isInputObjectType(
  node: DefinitionNode
): node is InputObjectTypeDefinitionNode {
  return node.kind === "InputObjectTypeDefinition";
}

function isEnumType(node: DefinitionNode): node is EnumTypeDefinitionNode {
  return node.kind === "EnumTypeDefinition";
}

export function globalTypesToString(
  schema: DocumentNode,
  scalarTypeMap: ScalarTypeInfoMap,
  config: Config
): string {
  const inputTypes = schema.definitions.filter(isInputObjectType);
  const enumTypes = schema.definitions.filter(isEnumType);
  return [
    config.hooks?.header ? config.hooks.header() : "",
    // TODO: How can user change this?
    config.options.copyDocuments ? "import gql from 'graphql-tag'" : "",
    ...inputTypes.map((t) => inputTypeToString(t, scalarTypeMap, config)),
    ...enumTypes.map((e) => enumTypeToString(e, config)),
  ].join(EOL);
}

function enumTypeToString(
  node: EnumTypeDefinitionNode,
  config: Config
): string {
  const name = node.name.value;
  const valueNodes = node.values;
  if (!valueNodes) throw Error(`Enum ${name} has no values!`);
  const values = valueNodes.map((e) => e.name.value);

  // User override
  if (config.hooks?.Enum) return config.hooks.Enum({ name, values });

  // Default, string union
  const value = values.map((v) => `"${v}"`).join(" | ");
  return `export type ${name} = ${value};`;
}

function inputTypeToString(
  node: InputObjectTypeDefinitionNode,
  scalarTypeMap: ScalarTypeInfoMap,
  config: Config
): string {
  // It's a scalar
  if (!node.fields) return "";

  const optional = config.options.optionalInputs ? "?" : "";

  const content = node.fields
    .map((f) => {
      const key = f.name.value;
      const value = schemaTypeToString(typeToSchemaType(f.type), scalarTypeMap);
      return `${key}${optional}: ${value};`;
    })
    .join(EOL);

  const name = node.name.value;
  return `
  export type ${name} = {
    ${content}
  }`;
}

function typeToSchemaType(node: TypeNode): SchemaTypeSummary {
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
): SchemaTypeSummary {
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
