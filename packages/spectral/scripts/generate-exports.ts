#!/usr/bin/env bun
/**
 * Generates the `exports` and `typesVersions` fields of package.json.
 *
 * Public entry points are the root, `./http` (the HTTP client) and `./testing`
 * (the test harness). Every `dist/` path that CommonJS resolution could reach
 * before this package declared `exports` is kept as well, so existing deep
 * imports such as `@prismatic-io/spectral/dist/clients/http` keep resolving,
 * for `require` and under native ESM alike. Those entries are deprecated:
 * import from the public entry points instead.
 *
 * The map is derived from src/ (mirroring what tsc emits to dist/), so it can
 * be regenerated and checked without a build. `--check` exits 1 when
 * package.json is stale.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const packageRoot = resolve(import.meta.dir, "..");
const srcRoot = join(packageRoot, "src");
const packageJsonPath = join(packageRoot, "package.json");

/** Mirrors tsconfig.json's `exclude`: these are never emitted to dist/. */
const EXCLUDED = [/\.test\.ts$/, /\.test-d\.ts$/];

const PUBLIC_EXPORTS: Record<string, unknown> = {
  ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
  "./http": { types: "./dist/clients/http/index.d.ts", default: "./dist/clients/http/index.js" },
  "./testing": { types: "./dist/testing.d.ts", default: "./dist/testing.js" },
  "./package.json": "./package.json",
};

/** For TypeScript's `moduleResolution: "node"`, which ignores `exports`. */
const TYPES_VERSIONS = {
  "*": {
    http: ["dist/clients/http/index.d.ts"],
    testing: ["dist/testing.d.ts"],
  },
};

const emittedModules = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return emittedModules(path);
    if (!name.endsWith(".ts") || name.endsWith(".d.ts")) return [];
    if (EXCLUDED.some((pattern) => pattern.test(name))) return [];
    return [relative(srcRoot, path).replace(/\.ts$/, "")];
  });

export const generateExports = (): Record<string, unknown> => {
  const deprecated: Record<string, string> = {};
  for (const module of emittedModules(srcRoot).sort()) {
    const target = `./dist/${module}.js`;
    deprecated[`./dist/${module}`] = target;
    deprecated[`./dist/${module}.js`] = target;
    if (module === "index" || module.endsWith("/index")) {
      const dir = module === "index" ? "./dist" : `./dist/${module.slice(0, -"/index".length)}`;
      deprecated[dir] = target;
    }
  }
  return { ...PUBLIC_EXPORTS, ...deprecated };
};

const withGeneratedFields = (pkg: Record<string, unknown>): Record<string, unknown> => {
  const generated = { exports: generateExports(), typesVersions: TYPES_VERSIONS };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(pkg)) {
    if (key === "exports" || key === "typesVersions") continue;
    out[key] = value;
    // Keep the entry-point fields together.
    if (key === "types") Object.assign(out, generated);
  }
  if (!("exports" in out)) Object.assign(out, generated);
  return out;
};

const current = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;
const next = withGeneratedFields(current);
const nextText = `${JSON.stringify(next, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(packageJsonPath, "utf8") !== nextText) {
    console.error(
      "package.json `exports`/`typesVersions` are stale; run `bun run build:exports` in packages/spectral",
    );
    process.exit(1);
  }
  console.log("package.json exports are up to date");
} else {
  writeFileSync(packageJsonPath, nextText);
  console.log(`wrote ${Object.keys(next.exports as object).length} export entries to package.json`);
}
