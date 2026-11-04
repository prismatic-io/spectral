import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { RunWarning } from "../../runner";
import { NPM_BUILD } from "../v10.36.0/callableComponentPackaging";
import codemod from "./callableEntryHooks";

const prismConfig = await readFile(
  new URL("../v10.36.0/fixtures/tsdown-callable.txt", import.meta.url),
  "utf8",
);

const PLATFORM_BUILD = `{
    entry: { index: "src/index.ts" },
    format: "cjs",
    outDir: "dist",
    platform: "node",
  }`;

const configWith = (npmBuild: string, imports = "") =>
  `${imports}import { defineConfig } from "tsdown";

export default defineConfig([
  ${PLATFORM_BUILD},
  ${npmBuild},
]);
`;

const run = async (config: string) => {
  const warnings: RunWarning[] = [];
  const edits = await codemod.plan(
    { read: async (path) => (path === "tsdown.config.mts" ? config : undefined) },
    { warn: (message, file) => warnings.push({ message, file }) },
  );
  return { config: edits[0]?.content, edits, warnings };
};

const HOOKS_IMPORT = 'import { callableEntryHooks } from "@prismatic-io/spectral/tsdown";';

describe("v10.39.0/callable-entry-hooks", () => {
  it("replaces the packaging codemod's inline hooks", async () => {
    const { config, warnings } = await run(configWith(NPM_BUILD));
    expect(warnings).toEqual([]);
    expect(config).toContain("hooks: callableEntryHooks(),");
    expect(config).not.toContain("build:before");
    expect(config).toContain(HOOKS_IMPORT);
  });

  it("replaces Prism's inline hooks and drops the fs imports only they used", async () => {
    const { config } = await run(prismConfig);
    expect(config).toContain("hooks: callableEntryHooks(),");
    expect(config).not.toContain("node:fs/promises");
    expect(config?.split("\n").slice(0, 2)).toEqual([
      'import { defineConfig } from "tsdown";',
      HOOKS_IMPORT,
    ]);
  });

  it("keeps an fs import the rest of the config still uses", async () => {
    const config = prismConfig.replace(
      "export default",
      'await rm("stale", { force: true });\n\nexport default',
    );
    const { config: result } = await run(config);
    expect(result).toContain('import { rm } from "node:fs/promises";');
  });

  it("leaves a config that already uses the hooks", async () => {
    const { config: once } = await run(configWith(NPM_BUILD));
    expect((await run(once as string)).edits).toEqual([]);
  });

  it("leaves a project without a callable npm build", async () => {
    expect((await run(configWith(PLATFORM_BUILD))).edits).toEqual([]);
  });

  it("warns about a callable npm build it does not recognize", async () => {
    const { edits, warnings } = await run(
      configWith(NPM_BUILD.replace('target: "node22"', 'target: "node24"')),
    );
    expect(edits).toEqual([]);
    expect(warnings).toEqual([
      {
        message: expect.stringMatching(/^The callable npm build differs/),
        file: "tsdown.config.mts",
      },
    ]);
  });
});
