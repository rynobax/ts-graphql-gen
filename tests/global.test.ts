import { format as prettierFormat } from "prettier";

import { globalTypesToString } from "../src/global";
import { parse } from "graphql";

const fmt = (str: string) => prettierFormat(str, { parser: "typescript" });

const runTest = (schema: string, expected: string) => {
  expect(
    fmt(
      globalTypesToString(parse(schema), new Map(), {
        options: { files: "", out: "", schema: "" },
      })
    )
  ).toEqual(fmt(expected));
};

test("no global types", () => {
  runTest(
    `
  type Query {
    foo: String!
  }
  `,
    ""
  );
});

test("input type", () => {
  runTest(
    `
  input CoolInput {
    num: Int!
    str: String
    foo: ComplexInput
  }

  input ComplexInput {
    bar: Boolean!
  }
  `,
    `
    export type CoolInput = {
      num: number;
      str: string | null;
      foo: ComplexInput | null;
    };

    export type ComplexInput = {
      bar: boolean;
    };
    `
  );
});
