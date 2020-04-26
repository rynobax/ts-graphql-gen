import { SchemaTypeSummary, ScalarTypeInfoMap } from "./types";

function graphqlTypeToTS(v: string, scalarTypeMap: ScalarTypeInfoMap): string {
  switch (v) {
    case "Boolean":
      return "boolean";
    case "Float":
      return "number";
    case "ID":
      return "string";
    case "Int":
      return "number";
    case "String":
      return "string";
    default:
      const scalarVal = scalarTypeMap.get(v);
      if (scalarVal) {
        // Custom scalar
        return scalarVal;
      } else {
        // Object type
        return v;
      }
  }
}

export function schemaTypeToString(
  v: SchemaTypeSummary,
  scalarTypeMap: ScalarTypeInfoMap
): string {
  let res = graphqlTypeToTS(v.value, scalarTypeMap);

  if (v.nullable) res += " | null";

  if (v.list) {
    res = `Array<${res}>`;
    if (v.list.nullable) res += ` | null`;
  }

  return res;
}

export function nonNull<T>(e: T | null): e is T {
  return e !== null;
}
