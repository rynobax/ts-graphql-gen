import { GraphQLError } from "graphql";
import { Document } from "./types";

export function reportParsingErrors(
  errorMessage: string[],
  fileName: string
): never {
  let errorMsg = `Found the following errors when parsing the file '${fileName}'\n`;
  errorMsg += errorMessage.map((e) => `  - ${e}`).join("\n");
  console.error(errorMsg);
  endProcess();
}

export function endProcess(): never {
  if (process.env.NODE_ENV === "test") throw Error();
  process.exit(1);
}

const PADDING = 6;
function highlightLineIssue(source: string, row: number) {
  console.error("The problematic line is shown below");
  console.error("");
  const lines = source.split("\n");
  for (let i = row - PADDING; i < row + PADDING; i++) {
    if (i < 0 || i >= lines.length) continue;
    let str = "";
    if (i === row - 1) str += "> ";
    else str += "  ";

    str += lines[i];
    console.error(str);
  }
}

export function printGraphQLError(
  e: GraphQLError,
  doc: Document,
  type: "schema" | "GraphQL document"
) {
  let locationInfo = "";
  if (e.locations) {
    locationInfo = ` on line ${e.locations[0].line}, column ${e.locations[0].column}`;
  }
  console.error(`Error parsing ${type} "${doc.file}"${locationInfo}`);
  console.error(`  - ${e.message}`);
  if (e.locations) {
    locationInfo = ` on line ${e.locations[0].line}, column ${e.locations[0].column}`;
    highlightLineIssue(doc.content, e.locations[0].line);
  }
}
