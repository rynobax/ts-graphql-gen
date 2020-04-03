import { parse } from "graphql";

import { computeSchemaTypeMap } from "../src/typeMap";
import { SchemaTypeMap } from "../src/types";

describe.only("computeSchemaTypeMap", () => {
  test.each<[string, string, SchemaTypeMap]>([
    [
      "basic",
      `type Query {
        foo: String
        bar: Int!
      }`,
      {
        Query: {
          fields: {
            foo: { value: "String", nullable: true, list: false },
            bar: { value: "Int", nullable: false, list: false },
          },
        },
      },
    ],
    [
      "object type",
      `type Query {
        dog: Dog!
        nullableDog: Dog
        dogList: [Dog!]!
      }
      
      type Dog {
        weight: Int!
      }
      `,
      {
        Query: {
          fields: {
            dog: { value: "Dog", nullable: false, list: false },
            nullableDog: { value: "Dog", nullable: true, list: false },
            dogList: {
              value: "Dog",
              nullable: false,
              list: { nullable: false },
            },
          },
        },
        Dog: {
          fields: {
            weight: { value: "Int", nullable: false, list: false },
          },
        },
      },
    ],
    [
      "list nullability",
      `type Query {
        one: [Int!]!
        two: [Int!]
        three: [Int]!
        four: [Int]
      }`,
      {
        Query: {
          fields: {
            one: { value: "Int", nullable: false, list: { nullable: false } },
            two: { value: "Int", nullable: false, list: { nullable: true } },
            three: { value: "Int", nullable: true, list: { nullable: false } },
            four: { value: "Int", nullable: true, list: { nullable: true } },
          },
        },
      },
    ],
    [
      "nested objects",
      `type Query {
        dog: Dog!
      }
      
      type Dog {
        size: Size!
      }

      type Size {
        length: Int!
        weight: Int!
      }
      `,
      {
        Query: {
          fields: {
            dog: { value: "Dog", nullable: false, list: false },
          },
        },
        Dog: {
          fields: {
            size: { value: "Size", nullable: false, list: false },
          },
        },
        Size: {
          fields: {
            length: { value: "Int", nullable: false, list: false },
            weight: { value: "Int", nullable: false, list: false },
          },
        },
      },
    ],
    [
      "interface",
      `
      schema {
        query: Query
      }
      
      type Query {
        animal: Animal!
      }
      
      interface Animal {
        id: String!
      }
      
      type Dog implements Animal {
        id: String!
        barks: Boolean!
      }
      
      type Cat implements Animal {
        id: String!
        meows: Boolean!
      }
      `,
      {
        Query: {
          fields: {
            animal: { value: "Animal", nullable: false, list: false },
          },
        },
        Animal: {
          typesThatImplementThis: {
            Dog: true,
            Cat: true,
          },
          fields: {
            id: { value: "String", nullable: false, list: false },
          },
        },
        Dog: {
          fields: {
            id: { value: "String", nullable: false, list: false },
            barks: { value: "Boolean", nullable: false, list: false },
          },
          typesThatThisImplements: {
            Animal: true,
          },
        },
        Cat: {
          fields: {
            id: { value: "String", nullable: false, list: false },
            meows: { value: "Boolean", nullable: false, list: false },
          },
          typesThatThisImplements: {
            Animal: true,
          },
        },
      },
    ],
  ])("%s", (_title, schema, result) => {
    expect(computeSchemaTypeMap(parse(schema))).toEqual(result);
  });
});
