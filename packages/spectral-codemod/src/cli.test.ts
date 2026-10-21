import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { main, parseArgs } from "./cli";

const capture = () => {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { log: (l: string) => out.push(l), error: (l: string) => err.push(l) }, out, err };
};

describe("parseArgs", () => {
  it("reads the codemod, path, and flags", () => {
    expect(parseArgs(["v10.36.0/integration-configuration", "./src", "--dry-run"])).toEqual({
      codemod: "v10.36.0/integration-configuration",
      path: "./src",
      dryRun: true,
      list: false,
      help: false,
    });
  });

  it("reads the spectral version to migrate to", () => {
    expect(parseArgs(["integration-configuration", "--target-spectral", "10.36.2"])).toEqual({
      codemod: "integration-configuration",
      targetSpectral: "10.36.2",
      dryRun: false,
      list: false,
      help: false,
    });
    expect(
      parseArgs(["integration-configuration", "--target-spectral=10.36.2"]).targetSpectral,
    ).toBe("10.36.2");
  });

  it("needs a version after --target-spectral", () => {
    expect(() => parseArgs(["integration-configuration", "--target-spectral"])).toThrow(
      "--target-spectral needs a spectral version.",
    );
    expect(() =>
      parseArgs(["integration-configuration", "--target-spectral", "--dry-run"]),
    ).toThrow("--target-spectral needs a spectral version.");
  });

  it("rejects unknown options and extra positionals", () => {
    expect(() => parseArgs(["--nope"])).toThrow("Unknown option: --nope");
    expect(() => parseArgs(["a", "b", "c"])).toThrow("Too many arguments");
  });
});

describe("main", () => {
  it("lists codemods", async () => {
    const { io, out } = capture();
    expect(await main(["--list"], io)).toBe(0);
    expect(out.join("\n")).toContain("v10.36.0/integration-configuration");
  });

  it("fails with usage when no codemod is named", async () => {
    const { io, err } = capture();
    expect(await main([], io)).toBe(1);
    expect(err[0]).toContain("Usage:");
  });

  it("fails for an unknown codemod and names the available ones", async () => {
    const { io, err } = capture();
    expect(await main(["nope"], io)).toBe(1);
    expect(err[0]).toContain('Unknown codemod "nope"');
    expect(err[0]).toContain("v10.36.0/integration-configuration");
  });

  it("fails for a codemod named without its version or a target", async () => {
    const { io, err } = capture();
    expect(await main(["integration-configuration"], io)).toBe(1);
    expect(err[0]).toContain('"integration-configuration" does not name a version.');
    expect(err[0]).toContain("v10.36.0/integration-configuration");
  });

  it.each([
    [["v10.36.0/integration-configuration"]],
    [["integration-configuration", "--target-spectral", "10.36.2"]],
  ])("runs a codemod against a path and reports the changed files: %j", async (args) => {
    const dir = await mkdtemp(join(tmpdir(), "spectral-codemod-cli-"));
    try {
      await writeFile(
        join(dir, "index.ts"),
        `import { configVar, integration } from "@prismatic-io/spectral";
export default integration({
  name: "Acme",
  configPages: { Page: { elements: { name: configVar({ stableKey: "n", dataType: "string" }) } } },
});
`,
      );
      const { io, out } = capture();

      expect(await main([...args, dir], io)).toBe(0);

      expect(out[0]).toBe("v10.36.0/integration-configuration: scanned 1 files, changed 1");
      expect(out[1]).toContain("index.ts");
      expect(await readFile(join(dir, "index.ts"), "utf8")).toContain("name: z.string(),");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
