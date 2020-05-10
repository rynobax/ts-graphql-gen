import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";

const extensions = [".ts", ".js", ".json"];

export default {
  input: "src/cli.ts",
  output: [
    {
      dir: "build",
      format: "cjs",
    },
  ],
  plugins: [
    babel({ babelHelpers: "bundled", extensions }),
    resolve({ extensions, rootDir: "src" }),
    commonjs({ extensions }),
  ],
  external: [
    /node_modules/,
    "graphql",
    "glob",
    "@oclif/command",
    "@graphql-toolkit/graphql-tag-pluck",
    "lodash",
    "prettier",
    "@oclif/errors/handle",
  ],
};
