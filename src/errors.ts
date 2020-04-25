// TODO: Probably want custom errors so we can differentiate from a crash
export function reportParsingErrors(errorMessage: string[], fileName: string) {
  let errorMsg = `Found the following errors when parsing the file '${fileName}'\n`;
  errorMsg += errorMessage.map((e) => `  - ${e}`).join("\n");
  console.error(errorMsg);
  endProcess();
}

export function endProcess() {
  if (process.env.NODE_ENV === "test") throw Error();
  process.exit(1);
}

const PADDING = 5;
export function highlightLineIssue(source: string, row: number) {
  console.error("The problematic line is shown below");
  console.error("");
  const lines = source.split("\n");
  for (let i = row - PADDING; i < row + PADDING; i++) {
    if (i < 0 || i > lines.length) continue;
    let str = "";
    if (i === row - 1) str += ">";
    else str += " ";

    str += lines[i - 1];
    console.error(str);
  }
}
