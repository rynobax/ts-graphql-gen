export interface Document {
  content: string;
  file: string;
}

export type SchemaValue = {
  value: string;
  nullable: boolean;
  list: { nullable: boolean } | false;
};

export interface SchemaTypeMap {
  [type: string]: {
    [field: string]: SchemaValue;
  };
}
