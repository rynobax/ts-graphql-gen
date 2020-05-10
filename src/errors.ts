import { GraphQLError } from "graphql";
import { Document } from "./types";
import { EOL } from "os";

export function reportParsingErrors(
  errorMessage: string[],
  fileName: string
): never {
  let errorMsg = `Found the following errors when parsing the file '${fileName}'\n`;
  errorMsg += errorMessage.map((e) => `  - ${e}`).join("\n");
  console.error(errorMsg);
  endProcess(errorMsg);
}

export function endProcess(msg: string): never {
  if (process.env.NODE_ENV === "test") throw Error();
  // In the UMD bundle this gets stripped, so the line below it runs
  process.exit(1);
  throw Error(msg);
}

const PADDING = 6;
function highlightLineIssue(source: string, row: number) {
  let msg = `The problematic line is shown below`;
  msg += EOL;
  const lines = source.split("\n");
  for (let i = row - PADDING; i < row + PADDING; i++) {
    if (i < 0 || i >= lines.length) continue;
    let str = "";
    if (i === row - 1) str += "> ";
    else str += "  ";

    str += lines[i];
    msg += `${EOL}${str}`;
  }
  return msg;
}

export function printGraphQLError(
  e: GraphQLError,
  doc: Document,
  type: "schema" | "GraphQL document"
): string {
  let locationInfo = "";
  if (e.locations) {
    locationInfo = ` on line ${e.locations[0].line}, column ${e.locations[0].column}`;
  }
  let msg = `Error parsing ${type} "${doc.file}"${locationInfo}`;
  msg += `${EOL}  - ${e.message}`;
  if (e.locations) {
    locationInfo = ` on line ${e.locations[0].line}, column ${e.locations[0].column}`;
    msg += highlightLineIssue(doc.content, e.locations[0].line);
  }
  console.error(msg);
  return msg;
}
