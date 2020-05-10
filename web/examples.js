const simpleSchema = `schema {
  query: Query
}

type Query {
  me: User!
  user(id: String!): User!
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

export const examples = {
  // Basic
  basic: {
    schema: simpleSchema,
    documents: `query Me {
  me {
    id
    bio
  }
}`,
  },
  // Union
  union: {
    schema: `schema {
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
    documents: `query GetAnimal {
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
  },
  // Fragments
  fragments: {
    schema: simpleSchema,
    documents: `query Me {
  me {
    id
    ...Bio
  }
}
fragment Bio on User {
  bio
  email
}`,
  },
};

export const configs = {
  basic: `export default {
  options: {
    files: "src/*.ts",
    schema: "schema.graphql",
    out: "src/graphqlTypes.tsx",
  }
}`,
  apolloReact: `function makeGeneric(returnType, variableType) {
  if (variableType) return \`\${returnType}, \${variableType}\`;
  else return \`\${returnType}\`;
}

function hooksHeader() {
  return \`import { QueryComponentOptions, MutationComponentOptions } from '@apollo/react-components';\`;
}

function queryHook({ operationName, returnType, variableType, documentVar }) {
  return \`
  export function use\${operationName}Query(
    options?: QueryHookOptions<\${makeGeneric(returnType, variableType)}>
  ) {
    return useQuery<\${makeGeneric(
      returnType,
      variableType
    )}>(\${documentVar}, options);
  }
  \`;
}

function mutationHook({
  operationName,
  returnType,
  variableType,
  documentVar,
}) {
  return \`
  export function use\${operationName}Mutation(
    options?: MutationHookOptions<\${makeGeneric(returnType, variableType)}>
  ) {
    return useMutation<\${makeGeneric(
      returnType,
      variableType
    )}>(\${documentVar}, options);
  }
  \`;
}

export default {
  options: {
    files: "localtesting/*.ts",
    schema: "localtesting/schema.graphql",
    out: "localtesting/result.tsx",
    copyDocuments: true,
  },
  scalars: {
    Date: "moment.Moment",
  },
  hooks: {
    header: () => {
      return \`
      /* THIS IS A GENERATED FILE, DO NOT EDIT DIRECTLY */
      \${hooksHeader()}
      \`;
    },
    Query: (info) => {
      return queryHook(info);
    },
    Mutation: (info) => {
      return mutationHook(info);
    },
  },
};
`,
};
