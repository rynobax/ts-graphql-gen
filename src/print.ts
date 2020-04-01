import { EOL } from "os";

import { SchemaType, OperationPrintTree, PrintTreeLeaf } from "./types";

export function treeToString(tree: OperationPrintTree): string {
  const name = tree.name;
  const suffix = tree.operationType;
  const fullName = name + suffix;

  return `
  type ${fullName} = {
    __typename: "${suffix}";
    ${leafsToString(tree.leafs)}
  }
  `;
}

function leafsToString(leafs: PrintTreeLeaf[]) {
  return leafs.map(leafToString).join(EOL);
}

function leafToString(leaf: PrintTreeLeaf): string {
  if (leaf.leafs.length > 0) {
    // object field
    const innerText = `{
      __typename: "${leaf.type.value}";
      ${leafsToString(leaf.leafs)}
    }`;
    return `${leaf.key}: ${listIfNecessary(leaf.type, innerText)}`;
  } else {
    // scalar field
    return `${leaf.key}: ${graphqlTypeToTS(leaf.type)};`;
  }
}

function graphqlTypeToTS(v: SchemaType): string {
  let res = "";
  switch (v.value) {
    case "Boolean":
      res = "boolean";
      break;
    case "Float":
      res = "number";
      break;
    case "ID":
      res = "string";
      break;
    case "Int":
      res = "number";
      break;
    case "String":
      res = "string";
      break;
    default:
      throw Error(`Unknown GraphQL scalar ${v.value}`);
  }

  if (v.nullable) res += " | null";

  if (v.list) {
    res = `Array<${res}>`;
    if (v.list.nullable) res += ` | null`;
  }

  return res;
}

function listIfNecessary(v: SchemaType, content: string) {
  if (!v.list) return content;
  if (v.list.nullable) {
    return `Array<${content} | null>`;
  } else {
    return `Array<${content}>`;
  }
}
