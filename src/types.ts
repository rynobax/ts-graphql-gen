export interface Document {
  content: string;
  file: string;
}

export type SchemaType = {
  value: string;
  // Whether or not the type in the list (eg User) can be null
  nullable: boolean;
  // Whether or not null can be returned instead of a list
  list: { nullable: boolean } | false;
};

export type SchemaTypeMap = Map<string, ReturnTypeInfo>;

export interface ReturnTypeInfo {
  // Types that implement this type
  typesThatImplementThis: Set<string>;
  // Types that this type implements
  typesThatThisImplements: Set<string>;
  fields: Map<string, SchemaType>;
}

export interface OperationPrintTree {
  outputTypeName: string;
  // The __typename of the operation (Query, Mutation, Subscription, fragment type name)
  rootTypeName: string;
  returnTypeTree: PrintTreeLeaf;
  variablesTypeTree: PrintTreeLeaf[];
  inputTypeTree: PrintTreeLeaf[];
}

export interface PrintTreeLeaf {
  // The name of the type of this node
  type: SchemaType;
  // Information about the type of the node
  typeInfo: ReturnTypeInfo | null;
  // The result field name (could be renamed from field)
  fieldName: string;
  // The possible versions that could exist
  // There is more than one if there are unions or interfaces involved
  leafs: PrintTreeLeaf[];
  // If this field is dependent on a interface
  condition: string | null;
}

export interface History {
  root: string;
  steps: string[];
}
