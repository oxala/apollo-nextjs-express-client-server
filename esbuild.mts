import { build, BuildOptions } from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";

const opts: BuildOptions = {
  bundle: true,
  outdir: "lib",
  platform: "node",
  target: ["node16"],
  entryPoints: ["source/server.ts", "source/client.tsx"],
  plugins: [nodeExternalsPlugin()],
};

await Promise.all([
  build({
    ...opts,
    format: "cjs",
  }),
  build({
    ...opts,
    format: "esm",
    outExtension: { ".js": ".mjs" },
  }),
]);
