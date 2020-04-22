import glob from "glob";
import { readFile as readFileNode } from "fs";
import { promisify } from "util";
import { gqlPluckFromCodeStringSync } from "@graphql-toolkit/graphql-tag-pluck";

const readFile = promisify(readFileNode);

function globPromise(pattern: string) {
  return new Promise<string[]>((resolve, reject) => {
    glob(pattern, {}, (err, files) => {
      if (err) return reject(err);
      else return resolve(files);
    });
  });
}

// Comes from graphql-tag-pluck
const supportedFilePaths = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".flow",
  ".flow.js",
  ".flow.jsx",
  ".vue",
];

export async function readFiles(pattern: string) {
  const filePaths = await globPromise(pattern);
  const supportedFiles = filePaths.filter((fp) =>
    supportedFilePaths.some((ext) => fp.endsWith(ext))
  );
  const fileBuffers = await Promise.all(
    supportedFiles.map((fp) => readFile(fp))
  );
  const fileStrings = fileBuffers.map((buf) => String(buf));
  return fileStrings.map((s, i) => ({ content: s, name: supportedFiles[i] }));
}

export function findGraphqlDocuments({
  content,
  name,
}: {
  content: string;
  name: string;
}): string | null {
  try {
    const gqlStuff = gqlPluckFromCodeStringSync(name, content);
    if (!gqlStuff) return null;
    else return gqlStuff;
  } catch (err) {
    if (err.loc) {
      const { line, column } = err.loc;
      const lines = content.split("\n");
      const errorLine = lines[line];
      console.error(
        `Babel ran into an issue parsing the file "${name}" on line ${line}, column ${column}.  The line is:\n${errorLine}`
      );
    }
    throw err;
  }
}

export async function readSchema(path: string) {
  const rawfile = await readFile(path);
  return String(rawfile);
}
