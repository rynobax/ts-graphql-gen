export const examples = [
  {
    title: "Basic",
    schema: `schema {
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
`,
    documents: `query Me {
  me {
    id
    bio
  }
}`,
  },
  {
    title: "Complex Unions",
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
    document: `query GetAnimal {
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
];

export const demoConfig = `{
  options: {
    schema: 'schema.graphql'
  }
}`;
