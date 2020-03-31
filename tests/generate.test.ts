import { format as prettierFormat } from "prettier";

import { generateTypesString } from "../src/generate";
import { Document } from "../src/types";

const schema = `
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
  email: String
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
      schema
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
      schema
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
      schema
    );
  });

  test("nested users", () => {
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
              logins
            }
          }
        }
      }`,
      ],
      `
    type MyFriendsQuery = {
      __typename: 'Query';
      me: {
        __typename: "User";
        id: string;
        friends: Array<{
          __typename: "User";
          name: {
            __typename: "Name";
            first: string;
            last: string;
          }
          friends: Array<{
            __typename: "User";
            id: string;
            logins: Array<number>;
          }>
        }>
      }
    }
    `,
      schema
    );
  });

  test("basic fragment", () => {
    runTest(
      [
        `
      query Me {
        me {
          id
          ...Bio
        }
      }
      fragment Bio on User {
        bio
        email
      }
      `,
      ],
      `
    type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        id: string;
        bio: string | null;
        email: string | null;
      }
    }
    `,
      schema
    );
  });

  test("fragment with object", () => {
    runTest(
      [
        `
      query Me {
        me {
          ...Friends
        }
      }
      fragment Friends on User {
        friends {
          id
        }
      }
      `,
      ],
      `
    type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        friends: Array<{
          __typename: 'User';
          id: string;
        }>
      }
    }
    `,
      schema
    );
  });

  test("nested fragments", () => {
    runTest(
      [
        `
      query Me {
        me {
          ...Friends
        }
      }

      fragment Friends on User {
        friends {
          id
          ...Bio
        }
      }
    
      fragment Bio on User {
        bio
        email
      }
      `,
      ],
      `
    type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        friends: Array<{
          __typename: 'User';
          id: string;
          bio: string | null;
          email: string | null;
        }>
      }
    }
    `,
      schema
    );
  });

  test("Duplicated fields", () => {
    runTest(
      [
        `
      query Me {
        me {
          id
          id
          ...DuplicateFrag
        }
      }
      fragment DuplicateFrag on User {
        id
        email
        email
      }
      `,
      ],
      `
    type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        id: string;
        email: string | null;
      }
    }
    `,
      schema
    );
  });
});
