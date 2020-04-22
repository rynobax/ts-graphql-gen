import { EOL } from "os";
import { uniq } from "lodash";

import { SchemaTypeSummary, OperationPrintTree, PrintTreeLeaf } from "./types";
import { schemaTypeToString } from "./util";

function nonNull<T>(e: T | null): e is T {
  return e !== null;
}

export function treeToString(tree: OperationPrintTree): string {
  return `${printOperation(tree)}${printVariables(tree)}`;
}

function printOperation({
  outputTypeName,
  returnTypeTree,
}: OperationPrintTree): string {
  // The result is going to include a "key" (eg. Query: {}) that we
  // can just throw away
  const res = returnTypeLeafsToString([returnTypeTree]);
  const inner = res.slice(res.indexOf(":") + 2);

  return `
  export type ${outputTypeName} = ${inner}
  `;
}

function printVariables({
  outputTypeName,
  variablesTypeTree: variables,
}: OperationPrintTree): string {
  if (variables.length === 0) return "";
  const typeName = outputTypeName + "Variables";
  return `
  export type ${typeName} = {
    ${variableTypeLeafsToString(variables)}
  }
  `;
}

function variableTypeLeafsToString(leafs: PrintTreeLeaf[]) {
  return mergeLeafs(leafs)
    .sort((a, b) => a.fieldName.localeCompare(b.fieldName))
    .map(variableTypeLeafToString)
    .join(EOL);
}

function returnTypeLeafsToString(leafs: PrintTreeLeaf[]) {
  return mergeLeafs(leafs)
    .sort((a, b) => a.fieldName.localeCompare(b.fieldName))
    .map(returnTypeLeafToString)
    .join(EOL);
}

function variableTypeLeafToString(leaf: PrintTreeLeaf): string {
  if (leaf.leafs.length > 0) {
    // input object field
    const typename = leaf.typesThatImplementThis
      ? leaf.typesThatImplementThis.map((e) => `"${e}"`).join(" | ")
      : `"${leaf.typeSummary.value}"`;
    let innerText = `{
      __typename: ${typename};
      ${returnTypeLeafsToString(leaf.leafs)}
    }`;
    return `${leaf.fieldName}: ${listIfNecessary(leaf.typeSummary, innerText)}`;
  } else {
    // scalar field
    return `${leaf.fieldName}: ${schemaTypeToString(leaf.typeSummary)};`;
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
      return `${leaf.fieldName}: ${listIfNecessary(
        leaf.typeSummary,
        innerText
      )};`;
    } else {
      // Single possible type
      const typename = leaf.typesThatImplementThis
        ? leaf.typesThatImplementThis.map((e) => `"${e}"`).join(" | ")
        : `"${leaf.typeSummary.value}"`;
      const innerText = `{
        __typename: ${typename};
        ${returnTypeLeafsToString(leafs)}
      }`;
      return `${leaf.fieldName}: ${listIfNecessary(
        leaf.typeSummary,
        innerText
      )};`;
    }
  } else {
    // scalar field
    return `${leaf.fieldName}: ${schemaTypeToString(leaf.typeSummary)};`;
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

  let arr = Object.entries(map);

  // If we have a more generic version of a key, remove the base version
  // eg. we throw out key "id | SomeInterface" if key "id" exists
  arr = arr.filter(
    ([k]) =>
      // We keep key if the following never happens
      !arr.some(
        ([otherKey]) =>
          // the element is not the same
          otherKey !== k &&
          // but there is a more generic version of this
          k.startsWith(otherKey)
      )
  );

  let merged = arr.map((e) => e[1]);

  // We render __typename differently from other types, so remove it
  merged = merged.filter((l) => l.fieldName !== "__typename");

  return merged;
}

const getLeafKey = (l: PrintTreeLeaf) =>
  l.condition ? `${l.fieldName} | ${l.condition}` : `${l.fieldName} |`;

function listIfNecessary(v: SchemaTypeSummary, content: string) {
  if (!v.list) return content;
  return `Array<${content}${orNull(v.nullable)}>${orNull(v.list.nullable)}`;
}

const orNull = (nullable: boolean) => (nullable ? " | null" : "");
