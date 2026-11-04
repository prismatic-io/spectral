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

const packageJson = (spectral: Record<string, string> = { devDependencies: "^10.39.0" }) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(spectral).map(([field, range]) => [
        field,
        { "@prismatic-io/spectral": range },
      ]),
    ),
  );

const run = async (config: string, pkg = packageJson()) => {
  const warnings: RunWarning[] = [];
  const files: Record<string, string> = { "tsdown.config.mts": config, "package.json": pkg };
  const edits = await codemod.plan(
    { read: async (path) => files[path] },
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

  it.each([
    ["an older dev dependency", { devDependencies: "^10.36.0" }],
    ["an older peer range", { devDependencies: "^10.39.0", peerDependencies: ">=10.36.0" }],
    ["a tag", { devDependencies: "latest" }],
    ["no spectral dependency", {}],
  ])("refuses a project whose spectral allows releases without the hooks: %s", async (_, spectral) => {
    await expect(run(configWith(NPM_BUILD), packageJson(spectral))).rejects.toThrow(
      /^callable-entry-hooks: /,
    );
  });

  it("names the range to raise when spectral is too old", async () => {
    await expect(
      run(configWith(NPM_BUILD), packageJson({ peerDependencies: "^10.36.0" })),
    ).rejects.toThrow(
      'peerDependencies must declare @prismatic-io/spectral at 10.39.0 or later, which exports @prismatic-io/spectral/tsdown; found "^10.36.0". Raise it to ^10.39.0',
    );
  });

  it("does not check spectral when there is nothing to rewrite", async () => {
    const { edits } = await run(
      configWith(PLATFORM_BUILD),
      packageJson({ devDependencies: "^10.36.0" }),
    );
    expect(edits).toEqual([]);
  });

  it("warns instead of declaring callableEntryHooks twice", async () => {
    const config = configWith(NPM_BUILD, 'import { callableEntryHooks } from "./local-build";\n');
    const { edits, warnings } = await run(config);
    expect(edits).toEqual([]);
    expect(warnings).toEqual([
      {
        message: expect.stringMatching(/^callableEntryHooks is already bound from \.\/local-build/),
        file: "tsdown.config.mts",
      },
    ]);
  });

  it("warns when the build calls a callableEntryHooks that is not spectral's", async () => {
    const { config } = await run(configWith(NPM_BUILD));
    const local = (config as string).replace("@prismatic-io/spectral/tsdown", "./local-build");
    const { edits, warnings } = await run(local);
    expect(edits).toEqual([]);
    expect(warnings).toEqual([
      {
        message: expect.stringMatching(
          /bound from \.\/local-build, not imported from @prismatic-io\/spectral\/tsdown/,
        ),
        file: "tsdown.config.mts",
      },
    ]);
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
