const { generateTypesString } = window.TsGraphqlGen;
import { examples, demoConfig } from "./examples.js";

function debounce(func, wait, immediate) {
  var timeout;

  return function executedFunction() {
    var context = this;
    var args = arguments;

    var later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    var callNow = immediate && !timeout;

    clearTimeout(timeout);

    timeout = setTimeout(later, wait);

    if (callNow) func.apply(context, args);
  };
}

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
    return err.message;
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

function selectExample(id) {
  const { documents, schema } = examples.find((e) => e.id === id);
  schemaCM.setValue(schema);
  documentCM.setValue(documents);
  configCM.setValue(demoConfig);
}

function main() {
  inputCMs.forEach((cm) => {
    cm.on(
      "change",
      debounce(
        () => {
          const newSchema = schemaCM.getValue();
          const newDocument = documentCM.getValue();
          outputCM.setValue(getContent(newDocument, newSchema));
        },
        50,
        false
      )
    );
  });
  selectExample("basic");

  const dropdown = document.getElementById("example-select");
  dropdown.onchange = (e) => selectExample(e.target.value);
}

main();
