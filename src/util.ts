import { SchemaTypeSummary } from "./types";

function graphqlTypeToTS(v: string): string {
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
      return v;
  }
}

export function schemaTypeToString(v: SchemaTypeSummary): string {
  let res = graphqlTypeToTS(v.value);

  if (v.nullable) res += " | null";

  if (v.list) {
    res = `Array<${res}>`;
    if (v.list.nullable) res += ` | null`;
  }

  return res;
}
