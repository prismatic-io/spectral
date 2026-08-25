import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Component } from "../../serverTypes";
import { manifestTestInputs } from "./manifestTestInputs";

type PrismModule = typeof import("../utils/prism");

vi.mock(import("../utils/prism"), async (importOriginal) => ({
  ...(await importOriginal()),
  getComponentSignatureWithPrism: vi
    .fn<PrismModule["getComponentSignatureWithPrism"]>()
    .mockResolvedValue("acme-signature"),
}));

import { createComponentManifest } from ".";

const component = {
  key: "acme",
  public: true,
  display: {
    label: "Acme",
    description: "An Acme component",
  },
  actions: {
    doThing: {
      key: "doThing",
      display: { label: "Do Thing", description: "Does a thing" },
      inputs: manifestTestInputs,
    },
  },
  triggers: {},
  dataSources: {},
  connections: [],
} as unknown as Component;

const snapshotDirectory = async (root: string): Promise<Record<string, string>> => {
  const snapshot: Record<string, string> = {};

  const visit = async (currentDir: string, relativeDir: string): Promise<void> => {
    const entries = await readdir(currentDir, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const relativePath = path.join(relativeDir, entry.name);
        const absolutePath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          snapshot[`${relativePath}/`] = "directory";
          await visit(absolutePath, relativePath);
          return;
        }

        snapshot[relativePath] = (await readFile(absolutePath)).toString("base64");
      }),
    );
  };

  await visit(root, "");
  return snapshot;
};

describe("component-manifest filesystem behavior", () => {
  const sourceDir = path.join(__dirname, "templates");
  let destinationDir: string;
  let consoleInfo: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    destinationDir = await mkdtemp(path.join(tmpdir(), "spectral-component-manifest-"));
    consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    consoleInfo.mockRestore();
    await rm(destinationDir, { recursive: true, force: true });
  });

  const run = async (dryRun: boolean) => {
    await createComponentManifest({
      component,
      dryRun,
      skipSignatureVerify: true,
      packageName: "@component-manifests/acme",
      spectralVersion: "1.2.3",
      verbose: false,
      sourceDir,
      destinationDir,
      registry: null,
    });
  };

  test("preserves an existing manifest during a dry run", async () => {
    const sentinel = path.join(destinationDir, "custom.ts");
    await writeFile(sentinel, "custom content", "utf8");
    const before = await snapshotDirectory(destinationDir);

    await run(true);

    expect(await snapshotDirectory(destinationDir)).toEqual(before);
    expect(await readFile(sentinel, "utf8")).toBe("custom content");
    expect(consoleInfo).toHaveBeenLastCalledWith(
      "Dry run completed successfully for Acme. No files were changed.",
    );
  });

  test("replaces stale files and generates a type-safe manifest outside dry-run mode", async () => {
    const staleFile = path.join(destinationDir, "stale.ts");
    await mkdir(destinationDir, { recursive: true });
    await writeFile(staleFile, "stale content", "utf8");

    await run(false);

    await expect(readFile(staleFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(destinationDir, "src", "index.ts"), "utf8")).toContain(
      'key: "acme"',
    );

    const action = await readFile(
      path.join(destinationDir, "src", "actions", "doThing.ts"),
      "utf8",
    );
    expect(action).toMatchSnapshot();
    expect(action).toContain("contact?: { firstName: string; active: boolean }");
    expect(action).toContain('inputType: "structuredObject"');
    expect(action).not.toContain("collection: undefined");
    expect(action).not.toContain("default: undefined");
    expect(action).not.toContain("dynamicSelection");
    expect(action).not.toContain("dynamicField");
  });
});
