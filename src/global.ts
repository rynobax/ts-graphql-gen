import {
  DocumentNode,
  DefinitionNode,
  InputObjectTypeDefinitionNode,
  TypeNode,
  ListTypeNode,
} from "graphql";
import { EOL } from "os";

function isInputObjectType(
  node: DefinitionNode
): node is InputObjectTypeDefinitionNode {
  return node.kind === "InputObjectTypeDefinition";
}

export function globalTypesToString(schema: DocumentNode): string {
  // TODO: Might be nice to print other stuff as well
  const inputTypes = schema.definitions.filter(isInputObjectType);
  return inputTypes.map(inputTypeToString).join(EOL);
}

function inputTypeToString(node: InputObjectTypeDefinitionNode): string {
  // It's a scalar
  if (!node.fields) return "";
  const content = node.fields
    .map((f) => {
      const key = f.name.value;
      const value = typeNodeToType(f.type);
      return `${key}: ${value};`;
    })
    .join(EOL);

  const name = node.name.value;
  return `
  type ${name} = {
    ${content}
  }`;
}

function typeNodeToType(type: TypeNode): string {
  switch (type.kind) {
    case "NonNullType":
      const nnType = type;
      switch (nnType.type.kind) {
        case "NamedType":
          return nnType.type.name.value;
        case "ListType":
          return `Array<${getListTypeName(nnType.type)}>`;
      }
    case "NamedType":
      return `${type.name.value} | null`;
    case "ListType":
      return `Array<${getListTypeName(type)}> | null`;
  }
}

function getListTypeName(node: ListTypeNode): string {
  const listType = node.type;
  switch (listType.kind) {
    case "NamedType":
      return `${listType.name.value} | null`;
    case "NonNullType":
      switch (listType.type.kind) {
        case "NamedType":
          return listType.type.name.value;
        default:
          throw Error(`Unimplemented listType type: ${listType.type.kind}`);
      }
    default:
      throw Error(`Unimplemented list type: ${listType.kind}`);
  }
}
