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
  bio: String
  logins: [Int!]!
}
`;

const doc = (content: string): Document => ({
  file: "somefile.ts",
  content: content.trim(),
});

const fmt = (str: string) => prettierFormat(str, { parser: "typescript" });

describe("generateTypes", () => {
  const runTest = (queries: string[], result: string, schema: string) => {
    expect(fmt(generateTypesString(queries.map(doc), schema))).toEqual(
      fmt(result)
    );
  };

  test.only("basic", () => {
    runTest(
      [
        `
      query Me {
        me {
          id
          bio
        }
      }`,
      ],
      `
    type MeQuery = {
      __typename: 'Query';
      me: {
        id: string;
        bio: string | null;
      }
    }
    `,
      userSchema
    );
  });

  test("list", () => {
    runTest(
      [
        `
        query Me {
          me {
            logins
          }
        }`,
      ],
      `
      type MeQuery = {
        __typename: 'Query';
        me: {
          logins: Array<number>;
        }
      }
      `,
      userSchema
    );
  });
});
