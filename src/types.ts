export interface Document {
  content: string;
  file: string;
}

export type SchemaTypeSummary = {
  value: string;
  // Whether or not the type in the list (eg User) can be null
  nullable: boolean;
  // Whether or not null can be returned instead of a list
  list: { nullable: boolean } | false;
};

export type ScalarTypeInfoMap = Map<string, string>;

export type ObjectTypeInfoMap = Map<string, ObjectTypeInfo>;

export interface ObjectTypeInfo {
  // Types that implement this type
  typesThatImplementThis: Set<string>;
  // Types that this type implements
  typesThatThisImplements: Set<string>;
  fields: Map<string, SchemaTypeSummary>;
}

export interface OperationPrintTree {
  // Name of the operation
  operationName: string;
  // What this type should be named when printed
  outputTypeName: string;
  // The __typename of the operation (Query, Mutation, fragment type name)
  rootTypeName: string;
  // The type of the query/mutation result
  returnTypeTree: PrintTreeLeaf;
  // The type of the variables for this query/mutation
  variablesTypeTree: PrintTreeLeaf[];
  // They type of the input types for the variables for this query/mutation
  inputTypeTree: PrintTreeLeaf[];
  // The graphql document this was generated from
  document: Document;
  // Names of fragments that this operation depends on
  fragmentNames: string[];
}

export interface PrintTreeLeaf {
  // The name of the type of this node
  typeSummary: SchemaTypeSummary;
  // Types that implement this type, used for typenames
  typesThatImplementThis: string[] | null;
  // The result field name (could be renamed from field)
  fieldName: string;
  // The possible versions that could exist
  // There is more than one if there are unions or interfaces involved
  leafs: PrintTreeLeaf[];
  // If this field is dependent on a specific interface or union type being returned
  condition: string | null;
}

export interface History {
  // The type that this type is based on (Query, Mutation, fragment type)
  root: string;
  // The steps into the objects that have been taken (eg. user -> name -> first)
  steps: string[];
}
