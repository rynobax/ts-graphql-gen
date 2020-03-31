import { format as prettierFormat } from "prettier";

import { generateTypesString } from "../src/generate";
import { Document } from "../src/types";

const userSchema = `
schema {
  query: Query
}

type Query {
  me: User!
}

type User {
  id: String!
}
`;

const doc = (content: string): Document => ({
  file: "somefile.ts",
  content: content.trim(),
});

const fmt = (str: string) => prettierFormat(str, { parser: "typescript" });

describe("generateTypes", () => {
  test.each<[string, string[], string, string]>([
    [
      "basic",
      [
        `
        query Me {
          me {
            id
          }
        }`,
      ],
      `
      type MeQuery = {
        __typename: 'Query';
        me: {
          id: string;
        }
      }
      `,
      userSchema,
    ],
  ])("%s", (_title, queries, result, schema) => {
    expect(fmt(generateTypesString(queries.map(doc), schema))).toEqual(
      fmt(result)
    );
  });
});
