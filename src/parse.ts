import glob from "glob";
import { readFile as readFileNode } from "fs";
import { promisify } from "util";
import * as babel from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as graphql from "graphql";

import { SchemaTypeMap, SchemaValue } from "./types";

const readFile = promisify(readFileNode);

function globPromise(pattern: string) {
  return new Promise<string[]>((resolve, reject) => {
    glob(pattern, {}, (err, files) => {
      if (err) return reject(err);
      else return resolve(files);
    });
  });
}

export async function readFiles(pattern: string) {
  const filePaths = await globPromise(pattern);
  const fileBuffers = await Promise.all(filePaths.map((fp) => readFile(fp)));
  const fileStrings = fileBuffers.map((buf) => String(buf));
  return fileStrings.map((s, i) => ({ content: s, name: filePaths[i] }));
}

export function findGraphqlDocuments(content: string): string[] {
  const ast = babel.parse(content, { sourceType: "module" });
  const docs: string[] = [];
  traverse(ast, {
    TemplateElement: (e) => {
      const { start, end } = e.node;
      if (start === null) throw Error("Node has no start");
      if (end === null) throw Error("Node has no end");
      const immediateParent = e.parentPath;
      if (immediateParent.type === "TemplateLiteral") {
        const grandParent = immediateParent.parent;
        if (grandParent.type === "TaggedTemplateExpression") {
          const { tag } = grandParent;
          if (tag.type === "Identifier") {
            if (tag.name === "gql") {
              const text = content.slice(start, end);
              docs.push(text.trim());
            }
          }
        }
      }
    },
  });
  return docs;
}

function getListSchemaValue(
  node: graphql.ListTypeNode,
  listIsNullable: boolean
): SchemaValue {
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

function getFieldSchemaValue(field: graphql.FieldDefinitionNode): SchemaValue {
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

export function computeSchemaTypeMap(document: graphql.DocumentNode) {
  const schema: SchemaTypeMap = {};
  document.definitions.forEach((def) => {
    switch (def.kind) {
      case "SchemaDefinition":
        break;
      case "ObjectTypeDefinition":
        schema[def.name.value] = {};
        def.fields?.forEach((field) => {
          const key = field.name.value;
          schema[def.name.value][key] = getFieldSchemaValue(field);
        });
        return;
      default:
        throw Error(`Unknown kind parsing schema: ${def.kind}`);
    }
  });
  return schema;
}

export async function parseSchema(path: string) {
  // TODO: Also handle JSON schema?
  const rawfile = await readFile(path);
  const file = String(rawfile);
  const document = graphql.parse(file);
  return {
    typeMap: computeSchemaTypeMap(document),
    schema: graphql.buildSchema(file),
  };
}
