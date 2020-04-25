import { Command, flags } from "@oclif/command";
import { format } from "prettier";

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
      options: { files, schema: schemaPath },
    } = config;

    const filesToCheck = await readFiles(files);
    const documents: Document[] = filesToCheck
      .map((e) => ({
        ...e,
        documents: findGraphqlDocuments(e),
      }))
      // Only care about files with a graphql document
      .filter(isFileWithDocument)
      .map((e) => ({ file: e.name, content: e.documents }));

    const schemaText = await readSchema(schemaPath);
    const output = generateTypesString(documents, schemaText, config);

    console.log("*** Output ***");
    console.log(format(output, { parser: "typescript" }));

    // TODO: Write output to file
  }
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
