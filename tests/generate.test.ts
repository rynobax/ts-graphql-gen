import { format as prettierFormat } from "prettier";

import { generateTypesString } from "../src/generate";
import { Document } from "../src/types";

const userSchema = `
schema {
  query: Query
}

type Query {
  me: User!
  testing: Testing
}

type Testing {
  listOne: [Int!]!
  listTwo: [Int!]
  listThree: [Int]!
  listFour: [Int]
}

type User {
  id: String!
  bio: String
  logins: [Int!]!
  friends: [User!]!
  name: Name!
}

type Name {
  first: String!
  last: String!
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

  test("basic", () => {
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
        __typename: 'User';
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
          __typename: 'User';
          logins: Array<number>;
        }
      }
      `,
      userSchema
    );
  });

  test("list combinations", () => {
    runTest(
      [
        `
        query ListTests {
          testing {
            listOne
            listTwo
            listThree
            listFour
          }
        }`,
      ],
      `
      type ListTestsQuery = {
        __typename: 'Query';
        testing: {
          __typename: 'Testing';
          listOne: Array<number>;
          listTwo: Array<number> | null;
          listThree: Array<number | null>;
          listFour: Array<number| null> | null;
        }
      }
      `,
      userSchema
    );
  });

  test.skip("nested users", () => {
    runTest(
      [
        `
      query MyFriends {
        me {
          id
          friends {
            name {
              first
              last
            }
            friends {
              id
            }
          }
        }
      }`,
      ],
      `
    type MyFriendsQuery = {
      __typename: 'Query';
      me: {
        id: string;
        friends: Array<{
          name: {
            first: string;
            last: string;
          }
          friends: Array<{
            id: string;
          }>
        }>
      }
    }
    `,
      userSchema
    );
  });
});
