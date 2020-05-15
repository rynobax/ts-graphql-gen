export interface Config {
  options: {
    files: string;
    schema: string;
    out: string;
    copyDocuments?: boolean;
  };
  hooks?: {
    header?: () => string;
    Query?: OperationFn;
    Mutation?: OperationFn;
    Enum?: EnumFn;
  };
  scalars?: Record<string, string>;
}

interface OperationInfo {
  operationName: string;
  returnType: string;
  variableType: string | null;
  documentVar: string;
}

type OperationFn = (bundle: OperationInfo) => string;

interface EnumInfo {
  name: string;
  values: string[];
}

type EnumFn = (bundle: EnumInfo) => string;

export async function getConfig(path: string): Promise<Config> {
  try {
    const maybeConfig = await import(path);

    try {
      if (typeof maybeConfig !== "object")
        throw Error("Config is not an object");
      const { options, hooks, scalars } = maybeConfig;

      if (typeof options !== "object")
        throw Error("Key 'options' is not an object");

      const { files, schema, out, copyDocuments } = options;

      if (typeof files !== "string")
        throw Error("Key 'options.files' is not a string");
      if (typeof schema !== "string")
        throw Error("Key 'options.schema' is not a string");
      if (typeof out !== "string")
        throw Error("Key 'options.out' is not a string");
      if (copyDocuments !== undefined && typeof copyDocuments !== "boolean")
        throw Error("Key 'options.copyDocuments' is not a boolean");

      if (hooks) {
        if (typeof hooks !== "object")
          throw Error("Key 'hooks' is not an object");
        const { Query, Mutation, Enum } = hooks;
        if (Query && typeof Query !== "function")
          throw Error("Key 'hooks.Query' is not a function");
        if (Mutation && typeof Mutation !== "function")
          throw Error("Key 'hooks.Mutation' is not a function");
        if (Enum && typeof Enum !== "function")
          throw Error("Key 'hooks.Enum' is not a function");
      }

      if (scalars) {
        if (typeof scalars !== "object")
          throw Error("Key 'scalars' is not an object");
        Object.entries(scalars).forEach(([k, v]) => {
          if (typeof v !== "string")
            throw Error(`Key 'scalars.${k}' is not a string`);
        });
      }

      return maybeConfig as Config;
    } catch (err) {
      console.error(`Issue decoding config file: ${err.message}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error loading config file: ${err.message}`);
    process.exit(1);
  }
}
