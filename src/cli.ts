import { Command, flags } from "@oclif/command";
import { format } from "prettier";

import { readFiles, findGraphqlDocuments, readSchema } from "./parse";
import { generateTypesString } from "./generate";
import { Document } from "./types";

class CLI extends Command {
  static description = "Generate typescript types from graphql files";

  static flags = {
    version: flags.version({ char: "v" }),
    files: flags.string({ char: "f" }),
    out: flags.string({ char: "o" }),
    schema: flags.string({ char: "s" }),
  };

  static args = [{ name: "file" }];

  async run() {
    const {
      flags: { files, out, schema: schemaPath },
    } = this.parse(CLI);

    if (!files) {
      // TODO: Complain about lack of files
      this.log("You need to provide files");
      this.exit(1);
    }

    if (!schemaPath) {
      // TODO: Complain about lack of out
      this.log("You need to provide schema");
      this.exit(1);
    }

    if (!out) {
      // TODO: Complain about lack of out
      this.log("You need to provide out");
      this.exit(1);
    }

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
    const output = generateTypesString(documents, schemaText);

    console.log(format(output, { parser: "typescript" }));

    // TODO: Write output to file
  }
}

// TODO: This stuff can probably be more elegant
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
