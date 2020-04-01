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
  const typeMap: SchemaTypeMap = {};

  function initializeType(typeName: string) {
    typeMap[typeName] = {
      fields: {},
    };
  }

  document.definitions.forEach((def) => {
    switch (def.kind) {
      case "SchemaDefinition":
        break;
      case "ObjectTypeDefinition":
      case "InterfaceTypeDefinition":
      case "UnionTypeDefinition":
        const name = def.name.value;

        if (!typeMap[name]) initializeType(name);

        // Objects and Interfaces
        if ("fields" in def && def.fields && def.fields.length > 0) {
          if (Object.keys(typeMap[name].fields).length > 1) {
            // An implementing type may already have created the structure,
            // but the type fields should only be set once, so if this happens
            // the schema has a duplicate type name
            throw Error(`Duplicate type name ${name}`);
          }

          def.fields.forEach((field) => {
            const key = field.name.value;
            typeMap[name].fields[key] = getFieldSchemaValue(field);
          });
        }

        // Interfaces
        if (
          "interfaces" in def &&
          def.interfaces &&
          def.interfaces.length > 0
        ) {
          def.interfaces.forEach((type) => {
            const ifName = type.name.value;
            if (!typeMap[ifName]) initializeType(ifName);

            // Add interfaces this implements
            typeMap[ifName].interfaces = {
              ...typeMap[ifName].interfaces,
              [name]: true,
            };

            // Keep track of what implements this type
            typeMap[name].implementors = {
              ...typeMap[name].implementors,
              [ifName]: true,
            };
          });
        }

        // Unions
        if ("types" in def && def.types && def.types.length > 0) {
          def.types.forEach((type) => {
            const uName = type.name.value;
            if (!typeMap[uName]) initializeType(uName);

            // Add interfaces this implements
            typeMap[uName].interfaces = {
              ...typeMap[uName].interfaces,
              [name]: true,
            };

            // Keep track of what implements this type
            typeMap[name].implementors = {
              ...typeMap[name].implementors,
              [uName]: true,
            };
          });
        }
        return;
      default:
        throw Error(`Unknown kind parsing schema: ${def.kind}`);
    }
  });
  return typeMap;
}

export function findCurrentTypeInMap(
  typeMap: SchemaTypeMap,
  history: History
): SchemaType {
  if (history.steps[history.steps.length - 1] === "__typename")
    return { value: "THIS_SHOULD_NOT_BE_USED", list: false, nullable: false };

  let last: SchemaTypeMap[string] = typeMap[history.root];
  let lastValue: SchemaType | null = null;
  history.steps.forEach((k) => {
    if (k === "__typename") {
      // __typename is special, we know what it should be from the last step
      if (!last) throw Error(`__typename type requires last`);
      if (!lastValue) throw Error(`__typename type requires lastValue`);

      if (last.interfaces) {
        // For interface, it's the union of all possible interfaces
        lastValue = {
          value: Object.keys(last.interfaces)
            .map((e) => `"${e}"`)
            .join(" | "),
          nullable: false,
          list: false,
        };
      } else {
        // For non interface, it's the type of the parent
        lastValue = {
          value: `"${lastValue.value}"`,
          nullable: false,
          list: false,
        };
      }
    } else {
      // Normal fields
      if (!last.fields[k])
        throw Error(`Missing field ${k} in type ${lastValue?.value}`);
      lastValue = last.fields[k];
      last = typeMap[lastValue.value];
    }
  });
  if (!lastValue) throw Error("Missing lastValue");
  return lastValue;
}
