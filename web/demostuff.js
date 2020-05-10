export const demoSchema = `schema {
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
`;

export const demoDocument = `query GetAnimal {
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
`;

export const demoConfig = `module.exports = {};`;
