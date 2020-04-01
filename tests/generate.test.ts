import { format as prettierFormat } from "prettier";

import { generateTypesString } from "../src/generate";
import { Document } from "../src/types";

const simpleSchema = `
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
      simpleSchema
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
      simpleSchema
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
      simpleSchema
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
      simpleSchema
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
      simpleSchema
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
      simpleSchema
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
      simpleSchema
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
      simpleSchema
    );
  });

  const interfaceSchema = `
  schema {
    query: Query
  }

  type Query {
    dog: Dog!
    cat: Cat!
    animal: Animal!
  }

  interface Animal {
    id: String!
    fur: String!
  }

  type Dog implements Animal {
    id: String!
    fur: String!
    barks: Boolean!
  }

  type Cat implements Animal {
    id: String!
    fur: String!
    meows: Boolean!
  }
  `;

  test("interface no spread", () => {
    runTest(
      [
        `
      query Dog {
        dog {
          id
          fur
          barks
        }
      }
      `,
      ],
      `
    type DogQuery = {
      __typename: 'Query';
      dog: {
        __typename: 'Dog';
        id: string;
        fur: string;
        barks: boolean;
      }
    }
    `,
      interfaceSchema
    );
  });

  test("interface no spread 2", () => {
    runTest(
      [
        `
      query Animal {
        animal {
          id
          fur
        }
      }
      `,
      ],
      `
    type AnimalQuery = {
      __typename: 'Query';
      animal: {
        __typename: 'Dog' | 'Cat';
        id: string;
        fur: string;
      }
    }
    `,
      interfaceSchema
    );
  });

  test("interface spread", () => {
    runTest(
      [
        `
      query Animal {
        animal {
          id
          fur
          ... on Dog {
            barks
          }
          ... on Cat {
            meows
          }
        }
      }
      `,
      ],
      `
    type AnimalQuery = {
      __typename: 'Query';
      animal: {
        __typename: 'Dog';
        id: string;
        fur: string;
        barks: boolean;
      } | {
        __typename: 'Cat';
        id: string;
        fur: string;
        meows: boolean;
      }
    }
    `,
      interfaceSchema
    );
  });

  const unionSchema = `
  schema {
    query: Query
  }

  type Query {
    animal: Animal!
  }

  union Animal = Dog | Cat

  type Dog {
    id: String!
    barks: Boolean!
  }

  type Cat {
    id: String!
    meows: Boolean!
  }
  `;

  test("union basic", () => {
    runTest(
      [
        `
      query Animal {
        animal {
          ... on Dog {
            id
            barks
          }
          ... on Cat {
            id
            meows
          }
        }
      }
      `,
      ],
      `
    type AnimalQuery = {
      __typename: 'Query';
      animal: {
        __typename: 'Dog';
        id: string;
        barks: boolean;
      } | {
        __typename: 'Cat';
        id: string;
        meows: boolean;
      }
    }
    `,
      unionSchema
    );
  });
});

// TODO: Test multiple documents
