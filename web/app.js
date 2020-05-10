const { generateTypesString } = window.TsGraphqlGen;
import { h, render } from "https://unpkg.com/preact?module";
import { useState } from "https://unpkg.com/preact/hooks/dist/hooks.module.js?module";
import htm from "https://unpkg.com/htm?module";
import { demoSchema, demoDocument, demoConfig } from "./demostuff.js";
const html = htm.bind(h);

const sections = {
  schema: { className: "schema", title: "Schema", defaultContent: demoSchema },
  document: {
    className: "document",
    title: "Document",
    defaultContent: demoDocument,
  },
  config: {
    className: "config",
    title: "Config",
    defaultContent: demoConfig,
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
        <${Section} section=${sections.schema} language="graphql" />
        <${Section} section=${sections.document} language="graphql" />
      </div>
      <div class="column">
        <${Section} section=${sections.config} language="typescript" />
        <${Section}
          section=${{
            className: "output",
            title: "Output",
            defaultContent: output,
          }}
          language="typescript"
        />
      </div>
    </div>
  `;
}

function Section({ section, language }) {
  return html`
    <div class="section ${section.className}">
      <div class="header">${section.title}</div>
      <pre class="pre">
        <code class="language-${language}">
          ${section.defaultContent}
        </code>
      </pre>
    </div>
  `;
}

render(html`<${App} />`, document.body);
