import { EOL } from "os";
import { uniq } from "lodash";

import { SchemaType, OperationPrintTree, PrintTreeLeaf } from "./types";
import { schemaTypeToString } from "./util";

function nonNull<T>(e: T | null): e is T {
  return e !== null;
}

export function treeToString(tree: OperationPrintTree): string {
  // console.dir(tree, {depth: 9});
  return `${printOperation(tree)}${printVariables(tree)}`;
}

function printOperation({
  name,
  suffix,
  returnTypeTree,
}: OperationPrintTree): string {
  const typeName = name + suffix;

  // The result is going to include a "key" (eg. Query: {}) that we
  // can just throw away
  const res = returnTypeLeafsToString([returnTypeTree]);
  const inner = res.slice(res.indexOf(":") + 2);

  return `
  type ${typeName} = ${inner}
  `;
}

function printVariables({
  name,
  suffix,
  variablesTypeTree: variables,
}: OperationPrintTree): string {
  if (variables.length === 0) return "";
  const typeName = name + suffix + "Variables";
  return `
  type ${typeName} = {
    ${variableTypeLeafsToString(variables)}
  }
  `;
}

function variableTypeLeafsToString(leafs: PrintTreeLeaf[]) {
  // Sort leafs alphabetically
  const sorted = mergeLeafs(leafs).sort((a, b) => a.key.localeCompare(b.key));
  return sorted.map(variableTypeLeafToString).join(EOL);
}

function returnTypeLeafsToString(leafs: PrintTreeLeaf[]) {
  // Sort leafs alphabetically
  const sorted = mergeLeafs(leafs).sort((a, b) => a.key.localeCompare(b.key));
  return sorted.map(returnTypeLeafToString).join(EOL);
}

function variableTypeLeafToString(leaf: PrintTreeLeaf): string {
  if (leaf.leafs.length > 0) {
    // input object field
    const typename =
      leaf.typeInfo && leaf.typeInfo.typesThatImplementThis.size > 0
        ? Array.from(leaf.typeInfo.typesThatImplementThis)
            .map((e) => `"${e}"`)
            .join(" | ")
        : `"${leaf.type.value}"`;
    const innerText = `{
      __typename: ${typename};
      ${returnTypeLeafsToString(leaf.leafs)}
    }`;
    return `${leaf.key}: ${listIfNecessary(leaf.type, innerText)}`;
  } else {
    // scalar field
    return `${leaf.key}: ${schemaTypeToString(leaf.type)};`;
  }
}

function returnTypeLeafToString(leaf: PrintTreeLeaf): string {
  if (leaf.leafs.length > 0) {
    // object field
    // Some leafs may be the same field, but with different subfields selected,
    // due to multiple fragments, so first we need to merge them
    const leafs = mergeLeafs(leaf.leafs);
    // Important that we don't use the merged leafs, because we want to
    // include the __typename for a interface even if we aren't getting
    // any of it's fields
    const conditions = uniq(
      leaf.leafs.map((l) => l.condition).filter(nonNull)
    ).sort((a, b) => a.localeCompare(b));
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
            ${returnTypeLeafsToString(relevantLeafs)}
          }`;
        })
        .join(` |${EOL}`);
      return `${leaf.key}: ${listIfNecessary(leaf.type, innerText)}`;
    } else {
      // Single possible type
      const typename =
        leaf.typeInfo && leaf.typeInfo.typesThatImplementThis.size > 0
          ? Array.from(leaf.typeInfo.typesThatImplementThis)
              .map((e) => `"${e}"`)
              .join(" | ")
          : `"${leaf.type.value}"`;
      const innerText = `{
        __typename: ${typename};
        ${returnTypeLeafsToString(leafs)}
      }`;
      return `${leaf.key}: ${listIfNecessary(leaf.type, innerText)}`;
    }
  } else {
    // scalar field
    return `${leaf.key}: ${schemaTypeToString(leaf.type)};`;
  }
}

// We merge leaf children that match by key fn, which looks at
// name + condition.
// This also removes duplicate fields
function mergeLeafs(leafs: PrintTreeLeaf[]): PrintTreeLeaf[] {
  const map: Record<string, PrintTreeLeaf> = {};
  leafs.forEach((leaf) => {
    const leafKey = getLeafKey(leaf);
    if (!map[leafKey]) map[leafKey] = leaf;
    else map[leafKey].leafs.push(...leaf.leafs);
  });
  let merged = Object.values(map);

  // We render __typename differently from other types, so remove it
  merged = merged.filter((l) => l.key !== "__typename");

  return merged;
}

const getLeafKey = (l: PrintTreeLeaf) => `${l.key} | ${l.condition}`;

function listIfNecessary(v: SchemaType, content: string) {
  if (!v.list) return content;
  if (v.list.nullable) {
    return `Array<${content} | null>`;
  } else {
    return `Array<${content}>`;
  }
}
