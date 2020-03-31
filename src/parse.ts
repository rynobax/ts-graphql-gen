import glob from "glob";
import { join } from 'path';
import { readFile as readFileNode } from "fs";
import { promisify } from "util";
import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import { buildSchema } from 'graphql';

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
  const fileBuffers = await Promise.all(filePaths.map(fp => readFile(fp)));
  const fileStrings = fileBuffers.map(buf => String(buf));
  return fileStrings.map((s, i) => ({ content: s, name: filePaths[i] }));
}

export function findGraphqlDocuments(content: string): string[] {
  const ast = parse(content, { sourceType: "module" });
  const docs: string[] = [];
  traverse(ast, {
    TemplateElement: e => {
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
    }
  });
  return docs;
}

export async function parseSchema(path: string) {
  // TODO: Also handle JSON schema?
  const file = await readFile(path);
  const schema = buildSchema(String(file));
  return schema;
}
