import {
  ListTypeNode,
  DocumentNode,
  TypeNode,
  ObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
} from "graphql";

import { SchemaTypeSummary, ObjectTypeInfoMap, History } from "./types";

function getListSchemaValue(
  node: ListTypeNode,
  listIsNullable: boolean
): SchemaTypeSummary {
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

export function typeNodeToSchemaValue(type: TypeNode): SchemaTypeSummary {
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

export function computeObjectTypeMap(document: DocumentNode) {
  const objectTypeMap: ObjectTypeInfoMap = new Map();

  document.definitions.forEach((def) => {
    switch (def.kind) {
      case "ObjectTypeDefinition":
      case "InterfaceTypeDefinition":
      case "UnionTypeDefinition":
        addObjectToMap(objectTypeMap, def);
        return;
      case "InputObjectTypeDefinition":
      case "EnumTypeDefinition":
        // These are printed in global
        return;
      case "SchemaDefinition":
      case "DirectiveDefinition":
        // These are ignored
        return;
      case "ScalarTypeDefinition":
        // TODO: These need to be dealt with
        return;
      default:
        throw Error(
          `Unknown kind parsing schema: ${def.kind}.  Please add an issue to GitHub!`
        );
    }
  });
  return objectTypeMap;
}

function addObjectToMap(
  objectTypeMap: ObjectTypeInfoMap,
  def:
    | ObjectTypeDefinitionNode
    | InterfaceTypeDefinitionNode
    | UnionTypeDefinitionNode
) {
  const name = def.name.value;

  if (!objectTypeMap.has(name)) initializeObjectType(objectTypeMap, name);

  // Can use nonNull assertion because we just initialized it above
  const {
    fields,
    typesThatImplementThis,
    typesThatThisImplements,
  } = objectTypeMap.get(name)!;

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
      if (!objectTypeMap.has(typeThatThisImplements))
        initializeObjectType(objectTypeMap, typeThatThisImplements);
      objectTypeMap
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
      if (!objectTypeMap.has(typeThatThisIsImplementedBy))
        initializeObjectType(objectTypeMap, typeThatThisIsImplementedBy);
      objectTypeMap
        // Can nonNull assert because it gets initialized above
        .get(typeThatThisIsImplementedBy)!
        .typesThatThisImplements.add(name);
    });
  }
}

function initializeObjectType(
  objectTypeMap: ObjectTypeInfoMap,
  typeName: string
) {
  objectTypeMap.set(typeName, {
    fields: new Map(),
    typesThatImplementThis: new Set(),
    typesThatThisImplements: new Set(),
  });
}

// TODO: Rename this
export function findTypeSummaryFromMap(
  objectTypeMap: ObjectTypeInfoMap,
  history: History
): SchemaTypeSummary {
  if (history.steps[history.steps.length - 1] === "__typename")
    return { value: "THIS_SHOULD_NOT_BE_USED", list: false, nullable: false };

  let last = objectTypeMap.get(history.root);
  let lastValue: SchemaTypeSummary | null = null;
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
      last = objectTypeMap.get(lastValue.value);
    }
  });
  if (!lastValue) throw Error("Missing lastValue");
  return lastValue;
}
