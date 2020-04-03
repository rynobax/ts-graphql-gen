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
        bio: string | null;
        id: string;
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
          listFour: Array<number| null> | null;
          listOne: Array<number>;
          listThree: Array<number | null>;
          listTwo: Array<number> | null;
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
        friends: Array<{
          __typename: "User";
          friends: Array<{
            __typename: "User";
            id: string;
            logins: Array<number>;
          }>
          name: {
            __typename: "Name";
            first: string;
            last: string;
          }
        }>
        id: string;
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
        bio: string | null;
        email: string | null;
        id: string;
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
          bio: string | null;
          email: string | null;
          id: string;
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
        email: string | null;
        id: string;
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
        barks: boolean;
        fur: string;
        id: string;
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
        __typename: 'Cat';
        fur: string;
        id: string;
      } | {
        __typename: 'Dog';
        fur: string;
        id: string;
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
        __typename: 'Cat';
        fur: string;
        id: string;
        meows: boolean;
      } | {
        __typename: 'Dog';
        barks: boolean;
        fur: string;
        id: string;
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
        __typename: 'Cat';
        id: string;
        meows: boolean;
      } | {
        __typename: 'Dog';
        barks: boolean;
        id: string;
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
        type: {
          __typename: 'Cat';
        } | {
          __typename: 'Dog';
          age:  {
            __typename: 'Known';
            months: number;
            years: number;
          } | {
            __typename: 'Unknown';
          }
        }
      }
    }
    `
    );
  });

  test("union and interface", () => {
    runTest(
      `
      schema {
        query: Query
      }
      
      type Query {
        animal: Animal!
      }
      
      union Age = Known | Unknown
      
      type Known {
        years: Int!
        months: Int!
      }
      
      type Unknown {
        reason: String!
      }

      interface Animal {
        id: String!
        age: Age!
      }

      type Dog implements Animal {
        id: String!
        age: Age!
        barks: Boolean!
      }

      type Cat implements Animal {
        id: String!
        age: Age!
        meows: Boolean!
      }
      `,
      [
        `
        query GetAnimal {
          animal {
            age {
              ... on Known {
                years
              }
              ... on Unknown {
                reason
              }
            }
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
    type GetAnimalQuery = {
      __typename: 'Query';
      animal: {
        __typename: 'Cat';
        age: {
          __typename: 'Known';
          years: number;
        } | {
          __typename: 'Unknown';
          reason: string;
        };
        meows: boolean;
      } | {
        __typename: 'Dog';
        age: {
          __typename: 'Known';
          years: number;
        } | {
          __typename: 'Unknown';
          reason: string;
        };
        barks: boolean;
      }
    }
    `
    );
  });
});

// TODO: Test multiple documents
// TODO: Multiple fragments
