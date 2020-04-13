export interface Document {
  content: string;
  file: string;
}

export type SchemaType = {
  value: string;
  nullable: boolean;
  list: { nullable: boolean } | false;
};

export interface SchemaTypeMap {
  // TODO: This key may end up not having other neighbors, if so can probably remove and flatten
  returnTypes: Map<string, ReturnTypeInfo>;
}

interface ReturnTypeInfo {
  // Types that implement this type
  typesThatImplementThis: Set<string>;
  // Types that this type implements
  typesThatThisImplements: Set<string>;
  fields: Map<string, SchemaType>;
}

export interface OperationPrintTree {
  // Name of the operation
  name: string;
  // Type of the operation (query, mutation, subscription)
  operationType: string;
  returnTypeTree: PrintTreeLeaf[];
  variablesTypeTree: PrintTreeLeaf[];
  inputTypeTree: PrintTreeLeaf[];
}

export interface PrintTreeLeaf {
  // The name of the type of this node
  type: SchemaType;
  // Information about the type of the node
  typeInfo: ReturnTypeInfo | null;
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
