import { Command, flags } from "@oclif/command";

import { readFiles, findGraphqlDocuments } from "./parse";

class CLI extends Command {
  static description = "Generate typescript types from graphql files";

  static flags = {
    version: flags.version({ char: "v" }),
    files: flags.string({ char: "f" }),
    out: flags.string({ char: "o" })
  };

  static args = [{ name: "file" }];

  async run() {
    const {
      flags: { files, out }
    } = this.parse(CLI);

    if (!files) {
      // TODO: Complain about lack of files
      this.log("You need to provide files!!");
      this.exit(1);
    }

    // TODO: Resolve glob pattern
    const filesToCheck = await readFiles(files);
    const documents = filesToCheck.map(e => ({
      ...e,
      documents: findGraphqlDocuments(e.content)
    }));

    if (!out) {
      // TODO: Complain about lack of out
    }

    // TODO: Find graphql documents from files
    // TODO: print types from docs at out
  }
}

(CLI.run() as Promise<unknown>).catch(require("@oclif/errors/handle"));
