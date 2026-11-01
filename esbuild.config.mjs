import esbuild from "esbuild";
import process from "node:process";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2020",
  outfile: "main.js",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  logLevel: "info",
  minify: production,
};

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
  process.stdout.write("Watching source files.\n");
} else {
  await esbuild.build(options);
}
