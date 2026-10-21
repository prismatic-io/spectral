import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { runCodemod } from "../../runner";
import codemod from "./callableComponentPackaging";

const exec = promisify(execFile);
const codemodRoot = fileURLToPath(new URL("../../../", import.meta.url));
const spectralRoot = resolve(codemodRoot, "../spectral");
const repoRoot = resolve(codemodRoot, "../..");

// Workspace package managers may hoist binaries or keep them beside their package.
const binary = async (name: string) => {
  for (const root of [codemodRoot, repoRoot]) {
    const path = join(root, "node_modules/.bin", name);
    try {
      return await realpath(path);
    } catch {}
  }
  throw new Error(`Install workspace dependencies before running this test (${name} missing).`);
};

it("builds and packs callable components consumable at runtime and in TypeScript", async () => {
  await access(join(spectralRoot, "dist/index.js")); // Root build builds Spectral first.
  const root = await mkdtemp(join(tmpdir(), "callable-package-build-"));
  const producer = join(root, "producer");
  const consumer = join(root, "consumer");
  const put = async (base: string, name: string, content: string) => {
    const path = join(base, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  };
  const linkSpectral = async (base: string) => {
    await mkdir(join(base, "node_modules/@prismatic-io"), { recursive: true });
    await symlink(spectralRoot, join(base, "node_modules/@prismatic-io/spectral"), "dir");
  };
  try {
    const tsdown = await binary("tsdown");
    const tsc = await binary("tsc");
    // Link tools themselves so config imports resolve without installing anything.
    for (const [name, executable] of [
      ["tsdown", tsdown],
      ["typescript", tsc],
    ]) {
      await mkdir(join(producer, "node_modules"), { recursive: true });
      // Both packages put their executable one directory below the package root.
      await symlink(dirname(dirname(executable)), join(producer, "node_modules", name), "dir");
    }
    await mkdir(join(producer, "node_modules/.bin"), { recursive: true });
    await symlink(tsdown, join(producer, "node_modules/.bin/tsdown"));
    await symlink(tsc, join(producer, "node_modules/.bin/tsc"));
    await linkSpectral(producer);
    await put(
      producer,
      "package.json",
      JSON.stringify({
        name: "callable-packaging-fixture",
        version: "1.0.0",
        private: true,
        scripts: { build: "tsdown" },
        exports: { "./helpers": "./helpers.js" },
        dependencies: { "@prismatic-io/spectral": "^10.36.0" },
        devDependencies: { tsdown: "0.22.3", typescript: "6.0.3" },
      }),
    );
    await put(producer, "assets/example.txt", "packaged asset");
    await put(producer, ".gitignore", "dist/\nnpm-dist/\nignored.txt\n");
    await put(producer, "ignored.txt", "must not ship");
    await put(producer, "helpers.js", "exports.marker = 'preserved';\n");
    await put(
      producer,
      "tsdown.config.mts",
      await readFile(new URL("./fixtures/tsdown-component.txt", import.meta.url), "utf8"),
    );
    await put(
      producer,
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          target: "es2022",
          module: "esnext",
          moduleResolution: "bundler",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
        include: ["src"],
      }),
    );
    await put(
      producer,
      "src/index.ts",
      `
import { action, component, input } from "@prismatic-io/spectral";
export default component({
  key: "packaging-fixture",
  display: { label: "Fixture", description: "Fixture", iconPath: "icon.png" },
  actions: { greet: action({
    display: { label: "Greet", description: "Greet" },
    inputs: { name: input({ type: "string", label: "Name", required: true }) },
    perform: async (_context, { name }) => ({ data: "Hello " + name }),
  }) },
});
`,
    );
    await runCodemod(codemod, { path: producer });
    const { stdout } = await exec("npm", ["pack", "--json", "--offline"], {
      cwd: producer,
      env: { ...process.env, npm_config_cache: join(root, "npm-cache") },
    });
    // npm forwards prepare output before its JSON report.
    const [packed] = JSON.parse(stdout.slice(stdout.lastIndexOf("\n[") + 1));
    expect(packed.files.map((file: { path: string }) => file.path)).toEqual(
      expect.arrayContaining([
        "dist/index.js",
        "dist/example.txt",
        "npm-dist/example.txt",
        "npm-dist/index.cjs",
        "npm-dist/index.d.cts",
        "helpers.js",
        "assets/example.txt",
      ]),
    );
    expect(packed.files.map((file: { path: string }) => file.path)).not.toContain("ignored.txt");
    await put(
      consumer,
      "package.json",
      JSON.stringify({ name: "consumer", version: "1.0.0", private: true }),
    );
    await exec(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--legacy-peer-deps",
        "--offline",
        "--no-audit",
        "--no-fund",
        join(producer, packed.filename),
      ],
      { cwd: consumer, env: { ...process.env, npm_config_cache: join(root, "npm-cache") } },
    );
    await linkSpectral(consumer);
    await put(
      consumer,
      "runtime.cjs",
      `
const assert = require("node:assert/strict");
const callable = require("callable-packaging-fixture");
const { flow } = require("@prismatic-io/spectral");
const { invokeFlow } = require("@prismatic-io/spectral/testing");
assert.equal(require("callable-packaging-fixture/helpers").marker, "preserved");
assert.equal(require("./node_modules/callable-packaging-fixture/dist/index.js").default.key, "packaging-fixture");
(async () => {
  const esm = await import("callable-packaging-fixture");
  assert.equal(esm.default, callable);
  const { result } = await invokeFlow(flow({ name: "Greet", stableKey: "greet",
    onExecution: async () => callable.actions.greet({ name: "world" }),
  }));
  assert.equal(result.data, "Hello world");
})().catch(error => { console.error(error); process.exitCode = 1; });
`,
    );
    await exec(process.execPath, ["runtime.cjs"], { cwd: consumer });
    await put(
      consumer,
      "consumer.cts",
      `
import callable from "callable-packaging-fixture";
callable.actions.greet({ name: "world" });
// @ts-expect-error name is required
callable.actions.greet({});
// @ts-expect-error name accepts strings
callable.actions.greet({ name: 42 });
// @ts-expect-error unknown actions must not become any
callable.actions.missing();
`,
    );
    await exec(
      process.execPath,
      [
        tsc,
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--esModuleInterop",
        "--target",
        "es2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "consumer.cts",
      ],
      { cwd: consumer },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
