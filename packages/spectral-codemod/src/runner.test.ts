import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { defineCodemod, eachFile } from "./codemod";
import { runCodemod } from "./runner";

const shout = defineCodemod({
  name: "shout",
  description: "Upper-cases the string literal `hello`",
  transform: eachFile((file) => {
    let changed = false;
    file.forEachDescendant((node) => {
      if (node.getText() === '"hello"') {
        node.replaceWithText('"HELLO"');
        changed = true;
      }
    });
    return changed;
  }),
});

const dirs: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "spectral-codemod-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const write = (dir: string, name: string, text: string) => {
  mkdirSync(join(dir, name, ".."), { recursive: true });
  writeFileSync(join(dir, name), text);
};

describe("runCodemod", () => {
  it("uses tsconfig.json to pick files and writes the changed ones", async () => {
    const dir = scratch();
    write(dir, "tsconfig.json", JSON.stringify({ include: ["src"] }));
    write(dir, "src/a.ts", 'export const a = "hello";\n');
    write(dir, "src/b.ts", 'export const b = "other";\n');
    write(dir, "scripts/c.ts", 'export const c = "hello";\n');

    const result = await runCodemod(shout, { path: dir });

    expect(result.scanned).toBe(2);
    expect(result.changed).toEqual([join(dir, "src/a.ts")]);
    expect(readFileSync(join(dir, "src/a.ts"), "utf8")).toBe('export const a = "HELLO";\n');
    expect(readFileSync(join(dir, "scripts/c.ts"), "utf8")).toBe('export const c = "hello";\n');
  });

  it("scans every TypeScript file except node_modules and dist without a tsconfig", async () => {
    const dir = scratch();
    write(dir, "src/a.ts", 'export const a = "hello";\n');
    write(dir, "node_modules/dep/index.ts", 'export const d = "hello";\n');
    write(dir, "dist/a.ts", 'export const a = "hello";\n');

    const result = await runCodemod(shout, { path: dir });

    expect(result.scanned).toBe(1);
    expect(result.changed).toHaveLength(1);
    expect(readFileSync(join(dir, "node_modules/dep/index.ts"), "utf8")).toContain('"hello"');
  });

  it("targets a single file", async () => {
    const dir = scratch();
    write(dir, "a.ts", 'export const a = "hello";\n');
    write(dir, "b.ts", 'export const b = "hello";\n');

    const result = await runCodemod(shout, { path: join(dir, "a.ts") });

    expect(result.scanned).toBe(1);
    expect(readFileSync(join(dir, "b.ts"), "utf8")).toContain('"hello"');
  });

  it("does not write in dry-run mode", async () => {
    const dir = scratch();
    write(dir, "a.ts", 'export const a = "hello";\n');

    const result = await runCodemod(shout, { path: dir, dryRun: true });

    expect(result.changed).toHaveLength(1);
    expect(readFileSync(join(dir, "a.ts"), "utf8")).toBe('export const a = "hello";\n');
  });

  it("rejects a missing path", async () => {
    await expect(runCodemod(shout, { path: join(scratch(), "nope") })).rejects.toThrow(
      "Path not found",
    );
  });
});
