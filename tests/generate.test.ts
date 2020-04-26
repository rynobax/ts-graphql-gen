import { format as prettierFormat } from "prettier";

import { generateTypesString } from "../src/generate";
import { Document } from "../src/types";
import { Config } from "../src/config";

const simpleSchema = `
schema {
  query: Query
}

type Query {
  me: User!
  user(id: String!): User!
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

const defaultConfig = () => ({
  options: { files: "", out: "", schema: "" },
});

const runTest = (
  schema: string,
  queries: string[],
  expected: string,
  config?: Config
) => {
  const result = generateTypesString(
    queries.map(doc),
    schema,
    config || defaultConfig()
  );

  expect(fmt(result)).toEqual(fmt(expected));
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
    export type MeQuery = {
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
    export type MeQuery = {
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
    export type ListTestsQuery = {
        __typename: 'Query';
        testing: {
          __typename: 'Testing';
          listFour: Array<number | null> | null;
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
    export type MyFriendsQuery = {
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
    export type MeQuery = {
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
    export type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        bio: string | null;
        email: string | null;
        id: string;
      }
    }

    export type BioFragment = {
      __typename: 'User';
      bio: string | null;
      email: string | null;
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
    export type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        friends: Array<{
          __typename: 'User';
          id: string;
        }>
      }
    }

    export type FriendsFragment = {
      __typename: 'User';
      friends: Array<{
        __typename: 'User';
        id: string;
      }>
    }
    `
  );
});

test("multiple fragments", () => {
  runTest(
    simpleSchema,
    [
      `
      query Me {
        me {
          id
          ...Bio
          ...Friends
        }
      }
      fragment Bio on User {
        bio
        email
      }
      fragment Friends on User {
        friends {
          id
        }
      }
      `,
    ],
    `
    export type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        bio: string | null;
        email: string | null;
        friends: Array<{
          __typename: 'User';
          id: string;
        }>
        id: string;
      }
    }

    export type BioFragment = {
      __typename: 'User';
      bio: string | null;
      email: string | null;
    }

    export type FriendsFragment = {
      __typename: 'User';
      friends: Array<{
        __typename: 'User';
        id: string;
      }>
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
    export type MeQuery = {
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

    export type FriendsFragment = {
      __typename: "User";
      friends: Array<{
        __typename: "User";
        bio: string | null;
        email: string | null;
        id: string;
      }>;
    };

    export type BioFragment = {
      __typename: "User";
      bio: string | null;
      email: string | null;
    };
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
    export type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        email: string | null;
        id: string;
      }
    }

    export type DuplicateFragFragment = {
      __typename: "User";
      email: string | null;
      id: string;
    };
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
    export type DogQuery = {
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
    export type AnimalQuery = {
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
    export type AnimalQuery = {
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

test("interface duplicates", () => {
  runTest(
    interfaceSchema,
    [
      `
      query Animal {
        animal {
          id
          ... on Dog {
            id
          }
        }
      }
      `,
    ],
    `
    export type AnimalQuery = {
      __typename: "Query";
      animal:
        | {
            __typename: "Cat";
            id: string;
          }
        | {
            __typename: "Dog";
            id: string;
          };
    };
    `
  );
});

const unionSchema = `
  schema {
    query: Query
  }

  type Query {
    animal: Animal!
    animals: [Animal!]!
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
    export type AnimalQuery = {
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

test("union list", () => {
  runTest(
    unionSchema,
    [
      `
      query Animals {
        animals {
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
    export type AnimalsQuery = {
      __typename: 'Query';
      animals: Array<{
        __typename: 'Cat';
        id: string;
        meows: boolean;
      } | {
        __typename: 'Dog';
        barks: boolean;
        id: string;
      }>
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
    export type GetAnimalQuery = {
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

    export type DogAgeFragment = {
      __typename: 'Cat';
    } | {
      __typename: 'Dog';
      age:  {
        __typename: 'Known';
        months: number;
      } | {
        __typename: 'Unknown';
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
    export type GetAnimalQuery = {
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

test("multiple documents", () => {
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
      `
      query MyFriends {
        me {
          id
          friends {
            id
          }
        }
      }`,
    ],
    `
    export type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        bio: string | null;
        id: string;
      }
    }

    export type MyFriendsQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        friends: Array<{
          __typename: 'User';
          id: string;
        }>
        id: string;
      }
    }
    `
  );
});

test("renaming field", () => {
  runTest(
    simpleSchema,
    [
      `
      query Me {
        me {
          coolId: id
          coolBio: bio
        }
      }`,
    ],
    `
    export type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        coolBio: string | null;
        coolId: string;
      }
    }
    `
  );
});

test("simple query argument", () => {
  runTest(
    simpleSchema,
    [
      `
      query User($id: String!) {
        user(id: $id) {
          bio
        }
      }`,
    ],
    `    
    export type UserQuery = {
      __typename: 'Query';
      user: {
        __typename: 'User';
        bio: string | null;
      }
    }

    export type UserQueryVariables = {
      id: string;
    }
    `
  );
});

test("complex query argument", () => {
  runTest(
    `
  schema {
    query: Query
  }
 
  input UserSearchInput {
    name: UserSearchNameInput
    email: String
  }

  input UserSearchNameInput {
    first: String!
    last: String!
  }

  type Query {
    users(input: UserSearchInput!, resultCount: Int): [User!]!
  }
  
  type User {
    id: String!
  }
  `,
    [
      `
    query Users($input: UserSearchInput!, $resultCount: Int) {
      users(input: $input, resultCount: $resultCount) {
        id
      }
    }`,
    ],
    `
    export type UserSearchInput = {           
      name: UserSearchNameInput | null;
      email: string | null;            
    };                                 
                                        
    export type UserSearchNameInput = {       
      first: string;                   
      last: string;                    
    };                                 
                                        
    export type UsersQuery = {
      __typename: 'Query';
      users: Array<{
        __typename: 'User';
        id: string;
      }>
    }

    export type UsersQueryVariables = {
      input: UserSearchInput;
      resultCount: number | null;
    }
    `
  );
});

test("simple mutation", () => {
  runTest(
    `
  schema {
    query: Query
    mutation: Mutation
  }

  type Query {
    id: Int
  }

  type Mutation {
    claimId: Int!
  }
  `,
    [
      `
    mutation ClaimId {
      claimId
    }
    `,
    ],
    `                                 
    export type ClaimIdMutation = {
      __typename: 'Mutation';
      claimId: number;
    }
    `
  );
});

test("complex mutation", () => {
  runTest(
    `
  schema {
    query: Query
    mutation: Mutation
  }

  type Query {
    id: Int
  }

  type Mutation {
    createUser(input: CreateUserInput): User!
  }

  type User {
    id: String!
    email: String
    name: Name!
  }

  type Name {
    first: String!
    last: String!
  }

  input CreateUserInput {
    age: Int!
    email: String
    name: NameInput!
  }

  input NameInput {
    first: String!
    last: String!
  }
  `,
    [
      `
    mutation NewUser($input: CreateUserInput!) {
      createUser(input: $input) {
        id
        email
        name {
          first
        }
      }
    }
    `,
    ],
    `
    export type CreateUserInput = {
      age: number;
      email: string | null;
      name: NameInput;
    };

    export type NameInput = {      
      first: string;
      last: string;
    };

    export type NewUserMutation = {
      __typename: 'Mutation';
      createUser: {
        __typename: 'User';
        email: string | null;
        id: string;
        name: {
          __typename: 'Name';
          first: string;
        }
      };
    }

    export type NewUserMutationVariables = {
      input: CreateUserInput;
    }
    `
  );
});

test("enum query", () => {
  runTest(
    `
    schema {
      query: Query
    }

    type Query {
      user: User!
    }
    
    type User {
      id: String!
      accountType: AccountType!
    }

    enum AccountType {
      ADMIN
      NORMAL
    }
    `,
    [
      `
      query User {
        user {
          accountType
          id
        }
      }`,
    ],
    `
    export type AccountType = 'ADMIN' | 'NORMAL';

    export type UserQuery = {
      __typename: 'Query';
      user: {
        __typename: 'User';
        accountType: AccountType;
        id: string;
      }
    }
    `
  );
});

test("enum mutation", () => {
  runTest(
    `
    schema {
      query: Query
    }

    type Query {
      user: User!
    }

    type Mutation {
      createUser(type: AccountType!): User!
    }
    
    type User {
      id: String!
      accountType: AccountType!
    }
    
    enum AccountType {
      ADMIN
      NORMAL
    }
    `,
    [
      `
      mutation CreateUser($type: AccountType!) {
        createUser(type: $type) {
          accountType
          id
        }
      }`,
    ],
    `
    export type AccountType = "ADMIN" | "NORMAL";

    export type CreateUserMutation = {
      __typename: "Mutation";
      createUser: {
        __typename: "User";
        accountType: AccountType;
        id: string;
      };
    };

    export type CreateUserMutationVariables = {
      type: AccountType;
    };
    `
  );
});

test("list nullability and objects", () => {
  runTest(
    `
  schema {
    query: Query
  }

  type Query {
    bothNull: [User]
    userNull: [User]!
    listNull: [User!]
    noNull: [User!]!
  }

  type User {
    id: String!
  }
  `,
    [
      `
    query Users {
      bothNull {
        id
      }
      userNull {
        id
      }
      listNull {
        id
      }
      noNull {
        id
      }
    }
    `,
    ],
    `                                 
    export type UsersQuery = {
      __typename: 'Query';
      bothNull: Array<{
        __typename: 'User';
        id: string;
      } | null> | null;
      listNull: Array<{
        __typename: 'User';
        id: string;
      }> | null;
      noNull: Array<{
        __typename: 'User';
        id: string;
      }>;
      userNull: Array<{
        __typename: 'User';
        id: string;
      } | null>;
    }
    `
  );
});

test("directive", () => {
  runTest(
    simpleSchema,
    [
      `
      query Me($getBio: Boolean!) {
        me {
          id
          bio @include(if: $getBio)
        }
      }`,
    ],
    `
    export type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        bio: string | null;
        id: string;
      }
    }

    export type MeQueryVariables = {
      getBio: boolean;
    }
    `
  );
});

test("copyDocuemnts", () => {
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
    import gql from 'graphql-tag';

    // Source: somefile.ts
    export const MeDocument = gql\`
    query Me {
      me {
        id
        bio
      }
    }
    \`;

    export type MeQuery = {
      __typename: 'Query';
      me: {
        __typename: 'User';
        bio: string | null;
        id: string;
      }
    }
    `,
    {
      ...defaultConfig(),
      options: { ...defaultConfig().options, copyDocuments: true },
    }
  );
});
