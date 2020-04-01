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
  [type: string]: SchemaTypeInfo;
}

interface SchemaTypeInfo {
  interfaces?: {
    [implementingType: string]: boolean;
  };
  fields: {
    [field: string]: SchemaType;
  };
}

export interface OperationPrintTree {
  // Name of the operation
  name: string;
  // Type of the operation (query, mutation, subscription)
  operationType: string;
  leafs: PrintTreeLeaf[];
}

export interface PrintTreeLeaf {
  // The name of the type of this node
  type: SchemaType;
  // Information about the type of the node
  typeInfo: SchemaTypeInfo;
  // The graphql field name
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
