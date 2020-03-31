import { Command, flags } from "@oclif/command";

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
      args,
      flags: { files, version, out }
    } = this.parse(CLI);

    if (version) {
      this.log(`TODO: Print version`);
    }

    if (!files) {
      // TODO: Complain about lack of files
    }

    // TODO: Resolve glob pattern
    const filesToCheck = [];

    if(!out) {
      // TODO: Complain about lack of out
    }

    // TODO: Find graphql documents from files
    // TODO: print types from docs at out
  }
}

export default CLI;
