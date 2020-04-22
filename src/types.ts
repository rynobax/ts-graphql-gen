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

export interface SchemaTypeMap {
  // TODO: This key may end up not having other neighbors, if so can probably remove and flatten
  returnTypes: Map<string, ReturnTypeInfo>;
}

export interface ReturnTypeInfo {
  // Types that implement this type
  typesThatImplementThis: Set<string>;
  // Types that this type implements
  typesThatThisImplements: Set<string>;
  fields: Map<string, SchemaType>;
}

export interface OperationPrintTree {
  // TODO: Should probably just merge name and suffix into one thing
  // Name of the operation
  name: string;
  // Type of the operation (query, mutation, subscription, fragment)
  suffix: string;
  // The __typename of the operation
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
  // TODO: Better name would probably make things clearer
  // The result field name (could be renamed from field)
  key: string;
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
