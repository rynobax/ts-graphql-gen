import { Command, flags } from "@oclif/command";
import { flatMap } from "lodash";

import { readFiles, findGraphqlDocuments, parseSchema } from "./parse";
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
    const documents: Document[] = flatMap(
      filesToCheck
        .map((e) => ({
          ...e,
          documents: findGraphqlDocuments(e.content),
        }))
        // Only care about files with a graphql document
        .filter((e) => e.documents.length > 0),
      (e) => e.documents.map((doc) => ({ file: e.name, content: doc }))
    );
    const { schema, typeMap } = await parseSchema(schemaPath);
    const output = generateTypesString(documents, typeMap, schema);

    console.log(output);

    // TODO: Write output to file
  }
}

(CLI.run() as Promise<unknown>).catch(require("@oclif/errors/handle"));
