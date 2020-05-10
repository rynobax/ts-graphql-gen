const { generateTypesString } = window.TsGraphqlGen;
import { examples, configs } from "./examples.js";

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

async function getContent(document, schema, config) {
  try {
    const encodedConfig = encodeURIComponent(config);
    const dataUri = "data:text/javascript;charset=utf-8," + encodedConfig;
    const parsedConfig = (await import(dataUri)).default;
    const raw = generateTypesString(
      [{ content: document, file: "example.ts" }],
      schema,
      parsedConfig
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
  const { documents, schema } = examples[id];
  schemaCM.setValue(schema);
  documentCM.setValue(documents);
}

function selectConfig(id) {
  const config = configs[id];
  configCM.setValue(config);
}

function main() {
  inputCMs.forEach((cm) => {
    cm.on(
      "change",
      debounce(
        async () => {
          const newSchema = schemaCM.getValue();
          const newDocument = documentCM.getValue();
          const newConfig = configCM.getValue();
          outputCM.setValue(
            await getContent(newDocument, newSchema, newConfig)
          );
        },
        50,
        false
      )
    );
  });
  selectExample("basic");
  selectConfig("basic");

  const exampleDropdown = document.getElementById("example-select");
  exampleDropdown.onchange = (e) => selectExample(e.target.value);

  const configDropdown = document.getElementById("config-select");
  configDropdown.onchange = (e) => selectConfig(e.target.value);
}

main();
