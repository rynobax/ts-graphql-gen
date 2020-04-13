import {
  ListTypeNode,
  DocumentNode,
  TypeNode,
  ObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
} from "graphql";

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

export function typeNodeToSchemaValue(type: TypeNode): SchemaType {
  switch (type.kind) {
    case "NonNullType":
      const nnType = type;
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
      return { value: type.name.value, nullable: true, list: false };
    case "ListType":
      return getListSchemaValue(type, true);
  }
}

export function computeSchemaTypeMap(document: DocumentNode) {
  const typeMap: SchemaTypeMap = {
    inputTypes: new Map(),
    returnTypes: new Map(),
  };

  document.definitions.forEach((def) => {
    switch (def.kind) {
      case "SchemaDefinition":
        break;
      case "ObjectTypeDefinition":
      case "InterfaceTypeDefinition":
      case "UnionTypeDefinition":
        addObjectToMap(typeMap, def);
        return;
      case "InputObjectTypeDefinition":
        addInputObjectToMap(typeMap, def);
        return;
      default:
        throw Error(`Unknown kind parsing schema: ${def.kind}`);
    }
  });
  // console.log(typeMap);
  return typeMap;
}

function addObjectToMap(
  typeMap: SchemaTypeMap,
  def:
    | ObjectTypeDefinitionNode
    | InterfaceTypeDefinitionNode
    | UnionTypeDefinitionNode
) {
  const name = def.name.value;

  if (!typeMap.returnTypes.has(name)) initializeReturnType(typeMap, name);

  // Can use nonNull assertion because we just initialized it above
  const {
    fields,
    typesThatImplementThis,
    typesThatThisImplements,
  } = typeMap.returnTypes.get(name)!;

  // Objects and Interfaces
  if ("fields" in def && def.fields && def.fields.length > 0) {
    if (fields.size > 1) {
      // An implementing type may already have created the structure,
      // but the type fields should only be set once, so if this happens
      // the schema has a duplicate type name
      throw Error(`Duplicate type name ${name}`);
    }

    def.fields.forEach((field) => {
      const key = field.name.value;
      fields.set(key, typeNodeToSchemaValue(field.type));
    });
  }

  // Interfaces
  if ("interfaces" in def && def.interfaces && def.interfaces.length > 0) {
    def.interfaces.forEach((intf) => {
      const typeThatThisImplements = intf.name.value;

      // Add interfaces that this implements
      typesThatThisImplements.add(typeThatThisImplements);

      // Add this to the interface it implements
      if (!typeMap.returnTypes.has(typeThatThisImplements))
        initializeReturnType(typeMap, typeThatThisImplements);
      typeMap.returnTypes
        // Can nonNull assert because it gets initialized above
        .get(typeThatThisImplements)!
        .typesThatImplementThis.add(name);
    });
  }

  // Unions
  if ("types" in def && def.types && def.types.length > 0) {
    def.types.forEach((type) => {
      const typeThatThisIsImplementedBy = type.name.value;

      // Add interfaces that this implements
      typesThatImplementThis.add(typeThatThisIsImplementedBy);

      // Add this to the interface it implements
      if (!typeMap.returnTypes.has(typeThatThisIsImplementedBy))
        initializeReturnType(typeMap, typeThatThisIsImplementedBy);
      typeMap.returnTypes
        // Can nonNull assert because it gets initialized above
        .get(typeThatThisIsImplementedBy)!
        .typesThatThisImplements.add(name);
    });
  }
}

function addInputObjectToMap(
  typeMap: SchemaTypeMap,
  def: InputObjectTypeDefinitionNode
) {
  const name = def.name.value;

  if (!typeMap.returnTypes.has(name)) initializeInputType(typeMap, name);

  // Can use nonNull assertion because we just initialized it above
  const { fields } = typeMap.inputTypes.get(name)!;
  if (fields.size > 1) {
    // An implementing type may already have created the structure,
    // but the type fields should only be set once, so if this happens
    // the schema has a duplicate type name
    throw Error(`Duplicate type name ${name}`);
  }

  if (def.fields) {
    def.fields.forEach((field) => {
      const key = field.name.value;
      fields.set(key, typeNodeToSchemaValue(field.type));
    });
  }
}

function initializeReturnType(typeMap: SchemaTypeMap, typeName: string) {
  typeMap.returnTypes.set(typeName, {
    fields: new Map(),
    typesThatImplementThis: new Set(),
    typesThatThisImplements: new Set(),
  });
}

function initializeInputType(typeMap: SchemaTypeMap, typeName: string) {
  typeMap.inputTypes.set(typeName, { fields: new Map() });
}

// TODO: Rename this
export function findCurrentTypeInMap(
  typeMap: SchemaTypeMap,
  history: History
): SchemaType {
  if (history.steps[history.steps.length - 1] === "__typename")
    return { value: "THIS_SHOULD_NOT_BE_USED", list: false, nullable: false };

  let last = typeMap.returnTypes.get(history.root);
  let lastValue: SchemaType | null = null;
  history.steps.forEach((k) => {
    if (k === "__typename") {
      // __typename is special, we know what it should be from the last step
      if (!last) throw Error(`__typename type requires last`);
      if (!lastValue) throw Error(`__typename type requires lastValue`);

      if (last.typesThatThisImplements) {
        // For interface, it's the union of all possible interfaces
        lastValue = {
          value: Array.from(last.typesThatThisImplements)
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
      if (!last) throw Error(`Missing type ${history.root} from typeMap`);
      // Normal fields
      const field = last.fields.get(k);
      if (!field) throw Error(`Missing field ${k} in type ${lastValue?.value}`);
      lastValue = field;
      last = typeMap.returnTypes.get(lastValue.value);
    }
  });
  if (!lastValue) throw Error("Missing lastValue");
  return lastValue;
}
