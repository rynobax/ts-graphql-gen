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
          foo: { value: "String", nullable: true, list: false },
          bar: { value: "Int", nullable: false, list: false },
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
          dog: { value: "Dog", nullable: false, list: false },
          nullableDog: { value: "Dog", nullable: true, list: false },
          dogList: { value: "Dog", nullable: false, list: { nullable: false } },
        },
        Dog: {
          weight: { value: "Int", nullable: false, list: false },
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
          one: { value: "Int", nullable: false, list: { nullable: false } },
          two: { value: "Int", nullable: false, list: { nullable: true } },
          three: { value: "Int", nullable: true, list: { nullable: false } },
          four: { value: "Int", nullable: true, list: { nullable: true } },
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
          dog: { value: "Dog", nullable: false, list: false },
        },
        Dog: {
          size: { value: "Size", nullable: false, list: false },
        },
        Size: {
          length: { value: "Int", nullable: false, list: false },
          weight: { value: "Int", nullable: false, list: false },
        },
      },
    ],
  ])("%s", (_title, schema, result) => {
    expect(computeSchemaTypeMap(parse(schema))).toEqual(result);
  });
});
