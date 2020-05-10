const { generateTypesString } = window.TsGraphqlGen;

// graphql does not ship umd version
const GQL_MODE = "text/plain";
const TS_MODE = "text/typescript";

function getContent(document, schema) {
  try {
    const config = eval(`(${demoConfig})`);
    const raw = generateTypesString(
      [{ content: document, file: "example.ts" }],
      schema,
      config
    );
    return prettier.format(raw, {
      parser: "typescript",
      plugins: prettierPlugins,
    });
  } catch (err) {
    console.error(err);
    return String(err);
  }
}

const schemaTa = document.getElementById("ta-schema");
const documentTa = document.getElementById("ta-document");
const configTa = document.getElementById("ta-config");
const outputTa = document.getElementById("ta-output");

const sharedOptions = { lineNumbers: true, theme: "dracula" };

const schemaCM = CodeMirror.fromTextArea(schemaTa, {
  ...sharedOptions,
  mode: GQL_MODE,
});
const documentCM = CodeMirror.fromTextArea(documentTa, {
  ...sharedOptions,
  mode: GQL_MODE,
});
const configCM = CodeMirror.fromTextArea(configTa, {
  ...sharedOptions,
  mode: TS_MODE,
});
const outputCM = CodeMirror.fromTextArea(outputTa, {
  ...sharedOptions,
  mode: TS_MODE,
  readOnly: true,
});

const inputCMs = [schemaCM, documentCM, configCM];

function selectExample(ndx) {
  const { documents, schema } = examples[ndx];
  schemaCM.setValue(schema);
  documentCM.setValue(documents);
  configCM.setValue(demoConfig);
  outputCM.setValue(getContent(documents, schema));
}

function main() {
  selectExample(0);
  inputCMs.forEach((cm) => {
    cm.on("change", () => {
      const newSchema = schemaCM.getValue();
      const newDocument = documentCM.getValue();
      outputCM.setValue(getContent(newDocument, newSchema));
    });
  });
}

main();
