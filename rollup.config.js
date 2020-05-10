import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import builtins from "rollup-plugin-node-builtins";
import replace from "@rollup/plugin-replace";

const extensions = [".ts", ".js", ".json"];

export default [
  // cjs
  {
    input: "src/cli.ts",
    output: {
      dir: "build",
      format: "cjs",
    },
    plugins: [
      babel({ babelHelpers: "bundled", extensions }),
      resolve({ extensions, rootDir: "src" }),
      commonjs({ extensions }),
    ],
    // Prevent rollup from including node_modules
    // I don't feel like including every package explicitly is the right way
    // to do this, but it works for now
    external: [
      /node_modules/,
      "graphql",
      "glob",
      "@oclif/command",
      "@graphql-toolkit/graphql-tag-pluck",
      "lodash/capitalize",
      "lodash/flatMap",
      "lodash/uniq",
      "prettier",
      "@oclif/errors/handle",
    ],
  },
  // UMD for demo web page
  {
    input: "src/generate.ts",
    output: {
      file: "web/build/generate-umd.js",
      format: "umd",
      name: "TsGraphqlGen",
    },
    plugins: [
      babel({ babelHelpers: "bundled", extensions }),
      resolve({ extensions, rootDir: "src" }),
      commonjs({ extensions }),
      builtins(),
      replace({
        "process.env.NODE_ENV": '"production"',
        "process.exit(1);": "",
        delimiters: ["", ""],
      }),
    ],
  },
];
