import { Command, flags } from "@oclif/command";
import { format } from "prettier";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

import { readFiles, findGraphqlDocuments, readSchema } from "./parse";
import { generateTypesString } from "./generate";
import { Document } from "./types";
import { getConfig } from "./config";

class CLI extends Command {
  static description = "Generate typescript types from graphql files";

  static flags = {
    version: flags.version({ char: "v" }),
    configPath: flags.string({ char: "c" }),
  };

  static args = [{ name: "file" }];

  async run() {
    const {
      flags: { configPath = "./ts-graphql-gen.config.js" },
    } = this.parse(CLI);

    const config = await getConfig(configPath);
    const {
      options: { files, schema: schemaPath, out: outPath },
    } = config;

    const filesToCheck = await readFiles(files);
    const documents: Document[] = filesToCheck
      // Ignore out out file
      // TODO: Might be better to convert to absolute before check
      .filter((e) => e.name !== outPath)
      .map((e) => ({
        ...e,
        documents: findGraphqlDocuments(e),
      }))
      // Only care about files with a graphql document
      .filter(isFileWithDocument)
      .map((e) => ({ file: e.name, content: e.documents }));

    const schemaText = await readSchema(schemaPath);
    const output = generateTypesString(documents, schemaText, config);

    const formatted = format(output, { parser: "typescript" });
    console.log("*** Output ***");
    console.log(formatted);

    // TODO: Write output to file
    writeToFile(outPath, formatted);
  }
}

function writeToFile(path: string, content: string) {
  const fp = join(process.cwd(), path);
  mkdirSync(join(fp, ".."), { recursive: true });
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
