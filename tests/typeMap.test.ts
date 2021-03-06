import { parse } from "graphql";

import { computeObjectTypeMap } from "../src/typeMap";
import { ObjectTypeInfoMap } from "../src/types";

describe.only("computeObjectTypeMap", () => {
  test.each<[string, string, ObjectTypeInfoMap]>([
    [
      "basic",
      `type Query {
        foo: String
        bar: Int!
      }`,
      new Map([
        [
          "Query",
          {
            fields: new Map([
              ["foo", { value: "String", nullable: true, list: false }],
              ["bar", { value: "Int", nullable: false, list: false }],
            ]),
            typesThatImplementThis: new Set(),
            typesThatThisImplements: new Set(),
          },
        ],
      ]),
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
      new Map([
        [
          "Query",
          {
            fields: new Map([
              ["dog", { value: "Dog", nullable: false, list: false }],
              ["nullableDog", { value: "Dog", nullable: true, list: false }],
              [
                "dogList",
                {
                  value: "Dog",
                  nullable: false,
                  list: { nullable: false },
                },
              ],
            ]),
            typesThatImplementThis: new Set(),
            typesThatThisImplements: new Set(),
          },
        ],
        [
          "Dog",
          {
            fields: new Map([
              ["weight", { value: "Int", nullable: false, list: false }],
            ]),
            typesThatImplementThis: new Set(),
            typesThatThisImplements: new Set(),
          },
        ],
      ]),
    ],
    [
      "list nullability",
      `type Query {
        one: [Int!]!
        two: [Int!]
        three: [Int]!
        four: [Int]
      }`,
      new Map([
        [
          "Query",
          {
            fields: new Map([
              [
                "one",
                {
                  value: "Int",
                  nullable: false,
                  list: { nullable: false },
                },
              ],
              [
                "two",
                {
                  value: "Int",
                  nullable: false,
                  list: { nullable: true },
                },
              ],
              [
                "three",
                {
                  value: "Int",
                  nullable: true,
                  list: { nullable: false },
                },
              ],
              [
                "four",
                {
                  value: "Int",
                  nullable: true,
                  list: { nullable: true },
                },
              ],
            ]),
            typesThatImplementThis: new Set(),
            typesThatThisImplements: new Set(),
          },
        ],
      ]),
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
      new Map([
        [
          "Query",
          {
            fields: new Map([
              ["dog", { value: "Dog", nullable: false, list: false }],
            ]),
            typesThatImplementThis: new Set(),
            typesThatThisImplements: new Set(),
          },
        ],
        [
          "Dog",
          {
            fields: new Map([
              ["size", { value: "Size", nullable: false, list: false }],
            ]),
            typesThatImplementThis: new Set(),
            typesThatThisImplements: new Set(),
          },
        ],
        [
          "Size",
          {
            fields: new Map([
              ["length", { value: "Int", nullable: false, list: false }],
              ["weight", { value: "Int", nullable: false, list: false }],
            ]),
            typesThatImplementThis: new Set(),
            typesThatThisImplements: new Set(),
          },
        ],
      ]),
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
      new Map([
        [
          "Query",
          {
            fields: new Map([
              ["animal", { value: "Animal", nullable: false, list: false }],
            ]),
            typesThatImplementThis: new Set(),
            typesThatThisImplements: new Set(),
          },
        ],
        [
          "Animal",
          {
            fields: new Map([
              ["id", { value: "String", nullable: false, list: false }],
            ]),
            typesThatImplementThis: new Set(["Dog", "Cat"]),
            typesThatThisImplements: new Set(),
          },
        ],
        [
          "Dog",
          {
            fields: new Map([
              ["id", { value: "String", nullable: false, list: false }],
              ["barks", { value: "Boolean", nullable: false, list: false }],
            ]),
            typesThatImplementThis: new Set(),
            typesThatThisImplements: new Set(["Animal"]),
          },
        ],
        [
          "Cat",
          {
            fields: new Map([
              ["id", { value: "String", nullable: false, list: false }],
              ["meows", { value: "Boolean", nullable: false, list: false }],
            ]),
            typesThatImplementThis: new Set(),
            typesThatThisImplements: new Set(["Animal"]),
          },
        ],
      ]),
    ],
  ])("%s", (_title, schema, result) => {
    expect(computeObjectTypeMap(parse(schema))).toEqual(result);
  });
});
