import { buildSchema } from "graphql";

import { generateTypesString } from "../src/generate";
import { Document } from "../src/types";

const schema = buildSchema(`
schema {
  query: Query
}

type Query {
  me: User!
}

type User {
  id: String!
}
`);

const doc = (content: string): Document => ({
  file: "somefile.ts",
  content: content.trim(),
});

describe("generateTypes", () => {
  test("basic", () => {
    expect(
      generateTypesString(
        [
          doc(`
    query Me {
      me {
        id
      }
    }
    `),
        ],
        schema
      )
    ).toEqual(`
    type MeQuery = {
      data: {
        me: {
          id: String
        }
      }
    }
    `);
  });
});
