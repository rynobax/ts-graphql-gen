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
  const runTest = (schema: string, queries: string[], result: string) => {
    expect(fmt(generateTypesString(queries.map(doc), schema))).toEqual(
      fmt(result)
    );
  };

  test("basic", () => {
    runTest(
      simpleSchema,
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
    `
    );
  });

  test("list", () => {
    runTest(
      simpleSchema,
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
      `
    );
  });

  test("list combinations", () => {
    runTest(
      simpleSchema,
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
      `
    );
  });

  test("nested users", () => {
    runTest(
      simpleSchema,
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
    `
    );
  });

  test("__typename", () => {
    runTest(
      simpleSchema,
      [
        `
      query Me {
        me {
          __typename
          id
        }
      }`,
      ],
      `
    type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        id: string;
      }
    }
    `
    );
  });

  test("basic fragment", () => {
    runTest(
      simpleSchema,
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
    `
    );
  });

  test("fragment with object", () => {
    runTest(
      simpleSchema,
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
    `
    );
  });

  test("nested fragments", () => {
    runTest(
      simpleSchema,
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
    `
    );
  });

  test("Duplicated fields", () => {
    runTest(
      simpleSchema,
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
    `
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
      interfaceSchema,
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
    `
    );
  });

  test("interface no spread 2", () => {
    runTest(
      interfaceSchema,
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
    `
    );
  });

  test("interface spread", () => {
    runTest(
      interfaceSchema,
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
    `
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
      unionSchema,
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
    `
    );
  });

  test("nested unions", () => {
    runTest(
      `
      schema {
        query: Query
      }
      
      type Query {
        animal: Animal!
      }
      
      type Animal {
        type: AnimalType!
      }
      
      union AnimalType = Dog | Cat
      
      union Age = Known | Unknown
      
      type Known {
        years: Int!
        months: Int!
      }
      
      type Unknown {
        reason: String!
      }
      
      type Dog {
        age: Age!
      }
      
      type Cat {
        age: Age!
      }
      `,
      [
        `
        query GetAnimal {
          animal {
            type {
              ... on Dog {
                __typename
                age {
                  ... on Known {
                    __typename
                    years
                  }
                }
              }
              ...DogAge
            }
          }
        }
      
        fragment DogAge on AnimalType {
          ... on Dog {
            __typename
            age {
              ... on Known {
                __typename
                months
              }
            }
          }
        }
      `,
      ],
      `
    type GetAnimalQuery = {
      __typename: 'Query';
      animal: {
        __typename: 'Animal';
        type:  {
          __typename: 'Dog';
          age:  {
            __typename: 'Known';
            years: number;
            months: number;
          } | {
            __typename: 'Unknown';
          }
        } | {
          __typename: 'Cat';
        }
      }
    }
    `
    );
  });
});

// TODO: Test multiple documents
