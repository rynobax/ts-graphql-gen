import { findGraphqlDocuments } from "../src/parse";
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
