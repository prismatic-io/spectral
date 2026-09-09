import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
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
    expect(parseArgs(["v10.0.0/headless-configuration", "./src", "--dry-run"])).toEqual({
      codemod: "v10.0.0/headless-configuration",
      path: "./src",
      dryRun: true,
      list: false,
      help: false,
    });
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
    expect(out.join("\n")).toContain("v10.0.0/headless-configuration");
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
    expect(err[0]).toContain("v10.0.0/headless-configuration");
  });

  it("runs a codemod against a path and reports the changed files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "spectral-codemod-cli-"));
    try {
      writeFileSync(
        join(dir, "index.ts"),
        `import { configVar, integration } from "@prismatic-io/spectral";
export default integration({
  name: "Acme",
  configPages: { Page: { elements: { name: configVar({ stableKey: "n", dataType: "string" }) } } },
});
`,
      );
      const { io, out } = capture();

      expect(await main(["v10.0.0/headless-configuration", dir], io)).toBe(0);

      expect(out[0]).toBe("v10.0.0/headless-configuration: scanned 1 files, changed 1");
      expect(out[1]).toContain("index.ts");
      expect(readFileSync(join(dir, "index.ts"), "utf8")).toContain("name: z.string(),");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
