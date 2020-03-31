import { findGraphqlDocuments, computeSchemaTypeMap } from "../src/parse";
import { parse } from "graphql";
import { SchemaTypeMap } from "../src/types";

const DOC_1_QUERY = `query Query1 {
  me {
    id
  }
}`;
const DOC_1 = `gql\`
${DOC_1_QUERY}
\``;

const DOC_2_QUERY = `query Query2 {
  me {
    id
  }
}`;
const DOC_2 = `gql\`
${DOC_2_QUERY}
\``;

describe("findGraphqlDocuments", () => {
  test("simple", () => {
    expect(
      findGraphqlDocuments(`
    import gql from 'graphql-tag';
    ${DOC_1}
    `)
    ).toEqual([DOC_1_QUERY]);
  });

  test("Can assign to variable", () => {
    expect(
      findGraphqlDocuments(`
    import gql from 'graphql-tag';
    const QUERY = ${DOC_1}
    `)
    ).toEqual([DOC_1_QUERY]);
  });

  test("two documents", () => {
    expect(
      findGraphqlDocuments(`
    import gql from 'graphql-tag';
    ${DOC_1}
    ${DOC_2}
    `)
    ).toEqual([DOC_1_QUERY, DOC_2_QUERY]);
  });

  test("inside a function", () => {
    expect(
      findGraphqlDocuments(`
    import gql from 'graphql-tag';
    function main() {
      ${DOC_1}
      ${DOC_2}
    }
    `)
    ).toEqual([DOC_1_QUERY, DOC_2_QUERY]);
  });

  test("ignores empty file", () => {
    expect(
      findGraphqlDocuments(`
    function main() {
      return true;
    }
    `)
    ).toEqual([]);
  });

  test("ignores different kind of template literal", () => {
    expect(
      findGraphqlDocuments(`
    import styled from 'styled-components';

    const ColoredDiv = styled.div\`
      background: green;
    \`;
    `)
    ).toEqual([]);
  });
});

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
