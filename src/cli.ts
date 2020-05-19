import { Command, flags } from "@oclif/command";
import { format } from "prettier";
import { writeFileSync, mkdirSync } from "fs";
import * as path from "path";
import chokidar from "chokidar";

import { readFiles, findGraphqlDocuments, readSchema } from "./parse";
import { generateTypesString } from "./generate";
import { Document } from "./types";
import { getConfig } from "./config";

const cwd = process.cwd();
const getAbsolutePath = (file: string) => path.join(cwd, file);

class CLI extends Command {
  static description = "Generate typescript types from graphql files";

  static flags = {
    version: flags.version({ char: "v" }),
    configPath: flags.string({ char: "c" }),
    watch: flags.boolean({ char: "w" }),
  };

  static args = [{ name: "file" }];

  async run() {
    const {
      flags: { configPath = "./ts-graphql-gen.config.js", watch },
    } = this.parse(CLI);

    const config = await getConfig(configPath);
    const {
      options: { files, schema: schemaPath, out: outPathRaw },
    } = config;

    const outPath = path.normalize(getAbsolutePath(outPathRaw));

    async function runGeneration() {
      const filesToCheck = await readFiles(files);
      const documents: Document[] = filesToCheck
        // Ignore out file
        .filter((e) => path.normalize(getAbsolutePath(e.name)) !== outPath)
        .map((e) => ({
          ...e,
          documents: findGraphqlDocuments(e),
        }))
        // Only care about files with a graphql document
        .filter(isFileWithDocument)
        .map((e) => ({ file: e.name, content: e.documents }));

      const schemaText = await readSchema(schemaPath);
      const output = generateTypesString(documents, schemaText, config);

      try {
        const formatted = format(output, { parser: "typescript" });
        // console.log("*** Output ***");
        // console.log(formatted);

        // TODO: Write output to file
        writeToFile(outPath, formatted);
      } catch (err) {
        console.error("Error formatting output");
        console.error(err.message);
      }
    }

    if (watch) {
      await runGeneration();
      console.log("watching");
      let needsToRebuild = false;
      let rebuilding = false;
      chokidar.watch(files, { ignoreInitial: true }).on("all", (_, file) => {
        const changedNormalized = path.normalize(getAbsolutePath(file));
        // Ignore the out file
        if (changedNormalized === outPath) return;
        console.log(`${file} changed, rebuilding`);
        // This is a super sus way of watching, fix this someday
        needsToRebuild = true;
      });
      setInterval(async () => {
        if (needsToRebuild && !rebuilding) {
          // Attempt rebuild
          try {
            rebuilding = true;
            needsToRebuild = false;
            await runGeneration();
          } catch (err) {
            console.error(err);
          }
          // Either way, mark as finished
          rebuilding = false;
          console.log("watching again");
        }
      }, 1000);
    } else {
      await runGeneration();
    }
  }
}

function writeToFile(fp: string, content: string) {
  mkdirSync(path.join(fp, ".."), { recursive: true });
  writeFileSync(fp, content, { flag: "w" });
}

interface FileMaybeDocument {
  documents: string | null;
  content: string;
  name: string;
}

interface FileWithDocument {
  documents: string;
  content: string;
  name: string;
}

function isFileWithDocument(file: FileMaybeDocument): file is FileWithDocument {
  return file.documents !== null;
}

(CLI.run() as Promise<unknown>).catch(require("@oclif/errors/handle"));
