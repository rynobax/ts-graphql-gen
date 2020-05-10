const { generateTypesString } = window.TsGraphqlGen;
import { h, render, Component } from "https://unpkg.com/preact@latest?module";
import {
  useRef,
  useEffect,
  useState,
} from "https://unpkg.com/preact@latest/hooks/dist/hooks.module.js?module";
import htm from "https://unpkg.com/htm@latest/dist/htm.module.js?module";
import { demoSchema, demoDocument, demoConfig } from "./demostuff.js";
const html = htm.bind(h);

// graphql does not ship umd version
const GQL_MODE = "text/plain";
const TS_MODE = "text/typescript";

const sections = {
  schema: {
    className: "schema",
    title: "Schema",
    defaultContent: demoSchema,
    language: GQL_MODE,
  },
  document: {
    className: "document",
    title: "Document",
    defaultContent: demoDocument,
    language: GQL_MODE,
  },
  config: {
    className: "config",
    title: "Config",
    defaultContent: demoConfig,
    language: TS_MODE,
  },
};

function App() {
  let output = "";
  try {
    const config = eval(`(${demoConfig})`);
    const raw = generateTypesString(
      [{ content: demoDocument, file: "example.ts" }],
      demoSchema,
      config
    );
    output = prettier.format(raw, {
      parser: "typescript",
      plugins: prettierPlugins,
    });
  } catch (err) {
    console.error(err);
    output = String(err);
  }
  return html`
    <div class="container">
      <div class="column">
        <${Section} section=${sections.schema} />
        <${Section} section=${sections.document} />
      </div>
      <div class="column">
        <${Section} section=${sections.config} />
        <${Section}
          section=${{
            className: "output",
            title: "Output",
            defaultContent: output,
            language: TS_MODE,
          }}
        />
      </div>
    </div>
  `;
}

class Section extends Component {
  constructor() {
    super();
    this.state = { initialized: false };
  }

  shouldComponentUpdate() {
    return false;
  }

  render() {
    const { section } = this.props;
    return html`
      <div class="section ${section.className}">
        <div class="header">${section.title}</div>
        <textarea
          ref=${(ref) => {
            if (!ref || this.state.initialized) return;
            this.setState({ initialized: true });
            const codeMirror = CodeMirror.fromTextArea(ref, {
              lineNumbers: true,
              mode: section.language,
              theme: "dracula",
            });
            setTimeout(() => {
              codeMirror.setValue(section.defaultContent);
              codeMirror.refresh();
            }, 1);
          }}
        >
        </textarea>
      </div>
    `;
  }
}

render(html`<${App} />`, document.body);
