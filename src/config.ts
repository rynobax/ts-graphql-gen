export interface Config {
  options: {
    files: string;
    schema: string;
    out: string;
  };
  hooks?: {
    header?: () => string;
    Query?: OperationFn;
    Mutation?: OperationFn;
  };
}

interface OperationBundle {
  operationName: string;
  returnType: string;
  variableType: string | null;
  documentType: string;
}

type OperationFn = (bundle: OperationBundle) => string;

export async function getConfig(path: string): Promise<Config> {
  try {
    const maybeConfig = await import(path);

    try {
      if (typeof maybeConfig !== "object")
        throw Error("Config is not an object");
      const { options, hooks } = maybeConfig;

      if (typeof options !== "object")
        throw Error("Key 'options' is not an object");

      const { files, schema, out } = options;

      if (typeof files !== "string")
        throw Error("Key 'options.files' is not a string");
      if (typeof schema !== "string")
        throw Error("Key 'options.schema' is not a string");
      if (typeof out !== "string")
        throw Error("Key 'options.out' is not a string");

      if (hooks) {
        if (typeof hooks !== "object")
          throw Error("Key 'hooks' is not an object");
        const { Query, Mutation } = hooks;
        if (Query && typeof Query !== "function")
          throw Error("Key 'hooks.Query' is not a function");
        if (Mutation && typeof Mutation !== "function")
          throw Error("Key 'hooks.Mutation' is not a function");
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
