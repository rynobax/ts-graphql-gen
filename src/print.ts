import { EOL } from "os";
import { uniq, uniqBy } from "lodash";

import { SchemaType, OperationPrintTree, PrintTreeLeaf } from "./types";

function nonNull<T>(e: T | null): e is T {
  return e !== null;
}

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
  // TODO: Does condition play into uniqueness?
  const leafs = uniqBy(leaf.leafs, (l) => l.key);
  if (leafs.length > 0) {
    // object field
    const conditions = uniq(leafs.map((l) => l.condition).filter(nonNull));
    if (conditions.length > 0) {
      // Multiple possible types
      // TODO: Can the two types be null and Something?
      // TODO: Is this going to work right with arrays?
      const innerText = conditions
        .map((c) => {
          const relevantLeafs = leafs.filter(
            (e) => !e.condition || e.condition === c
          );
          return `{
            __typename: "${c}";
            ${leafsToString(relevantLeafs)}
          }`;
        })
        .join(` |${EOL}`);
      return `${leaf.key}: ${listIfNecessary(leaf.type, innerText)}`;
    } else {
      // Single possible type
      const innerText = `{
        __typename: "${leaf.type.value}";
        ${leafsToString(leafs)}
      }`;
      return `${leaf.key}: ${listIfNecessary(leaf.type, innerText)}`;
    }
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
