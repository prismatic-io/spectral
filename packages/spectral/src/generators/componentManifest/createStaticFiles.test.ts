import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { renderPackageJson } from "./createStaticFiles";

describe("renderPackageJson", () => {
  const sourceDir = path.join(__dirname, "templates");
  let destinationDir: string;

  beforeEach(async () => {
    destinationDir = await mkdtemp(path.join(tmpdir(), "spectral-component-manifest-"));
  });

  afterEach(async () => {
    await rm(destinationDir, { recursive: true, force: true });
  });

  const render = async (
    overrides: Partial<Parameters<typeof renderPackageJson>[0]> = {},
  ): Promise<Record<string, any>> => {
    await renderPackageJson({
      dryRun: false,
      packageName: "@component-manifests/test",
      spectralVersion: "1.2.3",
      verbose: false,
      sourceDir,
      destinationDir,
      registry: null,
      ...overrides,
    });
    return JSON.parse(await readFile(path.join(destinationDir, "package.json"), "utf-8"));
  };

  test("uses the provided spectral version for the dev and peer dependency", async () => {
    const pkg = await render({ spectralVersion: "10.99.0" });
    expect(pkg.devDependencies["@prismatic-io/spectral"]).toBe("10.99.0");
    expect(pkg.peerDependencies["@prismatic-io/spectral"]).toBe(">= 10.99.0");
  });

  test("only the spectral dependency tracks the caller's spectralVersion", async () => {
    const a = await render({ spectralVersion: "1.0.0" });
    const b = await render({ spectralVersion: "999.0.0" });
    expect(a.devDependencies).toMatchObject({
      ...b.devDependencies,
      "@prismatic-io/spectral": expect.any(String),
    });
  });

  test("uses the provided package name", async () => {
    const pkg = await render({ packageName: "@acme/widget-manifest" });
    expect(pkg.name).toBe("@acme/widget-manifest");
  });

  test("omits publishConfig when no registry is provided", async () => {
    const pkg = await render({ registry: null });
    expect(pkg.publishConfig).toBeUndefined();
  });

  test("includes publishConfig when a registry is provided", async () => {
    const pkg = await render({ registry: "https://npm.example.com/" });
    expect(pkg.publishConfig).toEqual({ registry: "https://npm.example.com/" });
  });
});
