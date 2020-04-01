import { ListTypeNode, FieldDefinitionNode, DocumentNode } from "graphql";

import { SchemaType, SchemaTypeMap, History } from "./types";

function getListSchemaValue(
  node: ListTypeNode,
  listIsNullable: boolean
): SchemaType {
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

function getFieldSchemaValue(field: FieldDefinitionNode): SchemaType {
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
      case "InterfaceTypeDefinition":
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
  history: History
): SchemaType {
  let last: SchemaTypeMap[string] = typeMap[history.root];
  let lastValue: SchemaType | null = null;
  history.steps.forEach((k) => {
    if (!last[k]) throw Error(`Missing field ${k} in type ${lastValue?.value}`);
    lastValue = last[k];
    last = typeMap[lastValue.value];
  });
  if (!lastValue) throw Error("Missing lastValue");
  return lastValue;
}
