import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("node_modules/.cache/callable-fixture/", import.meta.url));
await mkdir(directory, { recursive: true });
for (const format of ["cjs", "esm"]) {
  const extension = format === "cjs" ? "cjs" : "mjs";
  const result = await Bun.build({
    entrypoints: [fileURLToPath(new URL("packaged-component.ts", import.meta.url))],
    outdir: directory,
    target: "node",
    format,
    naming: `component.${extension}`,
    sourcemap: "external",
  });

  if (!result.success) throw new AggregateError(result.logs, `Failed to bundle ${format} fixture`);
  const map = await Bun.file(join(directory, `component.${extension}.map`)).json();
  if (map.sources.some((path) => /node_modules\/(?:jest-mock|@jest|vitest|@vitest)\//.test(path))) {
    throw new Error("A runner dependency leaked into a component bundle");
  }
}
