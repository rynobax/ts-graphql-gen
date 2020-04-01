// TODO: Probably want custom errors so we can differentiate from a crash

import { Document } from "./types";

export type ErrorWithMessage = Error;

export function reportErrors(errors: ErrorWithMessage[], document: Document) {
  let errorMsg = `Found the following errors when parsing the file '${document.file}'\n`;
  errorMsg += errors.map((e) => `  - ${e.message}\n${e.stack}`).join("\n");
  console.error(errorMsg);
  process.exit(1);
  return null as any;
}
