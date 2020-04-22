import * as D from "io-ts/lib/Decoder";
import { isRight } from "fp-ts/lib/Either";
import { draw } from "io-ts/lib/Tree";

const configDecoder = D.type({
  options: D.type({
    files: D.string,
    schema: D.string,
    out: D.string,
  }),
});

type Config = D.TypeOf<typeof configDecoder>;

export async function getConfig(path: string): Promise<Config> {
  try {
    // TODO: May need to adjust path
    const maybeConfig = await import(path);
    const res = configDecoder.decode(maybeConfig);
    if (isRight(res)) {
      return res.right as Config;
    } else {
      console.error("Issue decoding config file:");
      console.error(draw(res.left));
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error loading config file: ${err.message}`);
    process.exit(1);
  }
}
