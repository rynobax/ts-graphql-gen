import { ListTypeNode, FieldDefinitionNode, DocumentNode } from "graphql";

import { SchemaValue, SchemaTypeMap } from "./types";

function getListSchemaValue(
  node: ListTypeNode,
  listIsNullable: boolean
): SchemaValue {
  const listType = node.type;
  switch (listType.kind) {
    case "NamedType":
      return {
        value: listType.name.value,
        nullable: true,
        list: { nullable: listIsNullable },
      };
    case "NonNullType":
      switch (listType.type.kind) {
        case "NamedType":
          return {
            value: listType.type.name.value,
            nullable: false,
            list: { nullable: listIsNullable },
          };
        default:
          throw Error(`Unimplemented listType type: ${listType.type.kind}`);
      }
    default:
      throw Error(`Unimplemented list type: ${listType.kind}`);
  }
}

function getFieldSchemaValue(field: FieldDefinitionNode): SchemaValue {
  switch (field.type.kind) {
    case "NonNullType":
      const nnType = field.type;
      switch (nnType.type.kind) {
        case "NamedType":
          return {
            value: nnType.type.name.value,
            nullable: false,
            list: false,
          };
        case "ListType":
          return getListSchemaValue(nnType.type, false);
      }
    case "NamedType":
      return { value: field.type.name.value, nullable: true, list: false };
    case "ListType":
      return getListSchemaValue(field.type, true);
  }
}

export function computeSchemaTypeMap(document: DocumentNode) {
  const schema: SchemaTypeMap = {};
  document.definitions.forEach((def) => {
    switch (def.kind) {
      case "SchemaDefinition":
        break;
      case "ObjectTypeDefinition":
        const name = def.name.value;
        if (schema[name]) {
          // TODO: test this
          throw Error(`Duplicate name ${name}`);
        }
        schema[name] = {};
        def.fields?.forEach((field) => {
          const key = field.name.value;
          schema[name][key] = getFieldSchemaValue(field);
        });
        return;
      default:
        throw Error(`Unknown kind parsing schema: ${def.kind}`);
    }
  });
  return schema;
}

export function findCurrentTypeInMap(
  typeMap: SchemaTypeMap,
  history: string[]
): SchemaValue {
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
  return lastValue;
}
