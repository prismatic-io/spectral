import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { defineCodemod, eachFile } from "./codemod";
import { runCodemod } from "./runner";

const shout = defineCodemod({
  version: "10.36.0",
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
const scratch = async () => {
  const dir = await mkdtemp(join(tmpdir(), "spectral-codemod-"));
  dirs.push(dir);
  return dir;
};
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

const write = async (dir: string, name: string, text: string) => {
  await mkdir(join(dir, name, ".."), { recursive: true });
  await writeFile(join(dir, name), text);
};

describe("runCodemod", () => {
  it("uses tsconfig.json to pick files and writes the changed ones", async () => {
    const dir = await scratch();
    await write(dir, "tsconfig.json", JSON.stringify({ include: ["src"] }));
    await write(dir, "src/a.ts", 'export const a = "hello";\n');
    await write(dir, "src/b.ts", 'export const b = "other";\n');
    await write(dir, "scripts/c.ts", 'export const c = "hello";\n');

    const result = await runCodemod(shout, { path: dir });

    expect(result.scanned).toBe(2);
    expect(result.changed).toEqual([join(dir, "src/a.ts")]);
    expect(await readFile(join(dir, "src/a.ts"), "utf8")).toBe('export const a = "HELLO";\n');
    expect(await readFile(join(dir, "scripts/c.ts"), "utf8")).toBe('export const c = "hello";\n');
  });

  it("scans every TypeScript file except node_modules and dist without a tsconfig", async () => {
    const dir = await scratch();
    await write(dir, "src/a.ts", 'export const a = "hello";\n');
    await write(dir, "node_modules/dep/index.ts", 'export const d = "hello";\n');
    await write(dir, "dist/a.ts", 'export const a = "hello";\n');

    const result = await runCodemod(shout, { path: dir });

    expect(result.scanned).toBe(1);
    expect(result.changed).toHaveLength(1);
    expect(await readFile(join(dir, "node_modules/dep/index.ts"), "utf8")).toContain('"hello"');
  });

  it("targets a single file and the files it imports", async () => {
    const dir = await scratch();
    await write(dir, "a.ts", 'import { b } from "./b";\nexport const a = "hello";\n');
    await write(dir, "b.ts", 'export const b = "hello";\n');
    await write(dir, "c.ts", 'export const c = "hello";\n');

    const result = await runCodemod(shout, { path: join(dir, "a.ts") });

    expect(result.scanned).toBe(2);
    expect(result.changed.sort()).toEqual([join(dir, "a.ts"), join(dir, "b.ts")]);
    expect(await readFile(join(dir, "c.ts"), "utf8")).toContain('"hello"');
  });

  it("targets a single file with the test files that import what it loads", async () => {
    const dir = await scratch();
    await write(dir, "src/a.ts", 'import { b } from "./b";\nexport const a = "hello";\n');
    await write(dir, "src/b.ts", 'export const b = "hello";\n');
    await write(dir, "src/b.test.ts", 'import { b } from "./b";\nexport const t = "hello";\n');
    await write(dir, "src/other.ts", 'export const o = "hello";\n');
    await write(
      dir,
      "src/other.test.ts",
      'import { o } from "./other";\nexport const t = "hello";\n',
    );

    const result = await runCodemod(shout, { path: join(dir, "src/a.ts") });

    expect(result.changed.sort()).toEqual([
      join(dir, "src/a.ts"),
      join(dir, "src/b.test.ts"),
      join(dir, "src/b.ts"),
    ]);
    expect(await readFile(join(dir, "src/other.test.ts"), "utf8")).toContain('"hello"');
  });

  it("does not write in dry-run mode", async () => {
    const dir = await scratch();
    await write(dir, "a.ts", 'export const a = "hello";\n');

    const result = await runCodemod(shout, { path: dir, dryRun: true });

    expect(result.changed).toHaveLength(1);
    expect(await readFile(join(dir, "a.ts"), "utf8")).toBe('export const a = "hello";\n');
  });

  it("awaits asynchronous file transforms before saving", async () => {
    const dir = await scratch();
    await write(dir, "index.ts", 'export const value = "before";\n');
    await write(dir, "replacement.txt", 'export const value = "after";\n');
    const codemod = defineCodemod({
      version: "10.36.0",
      name: "async-edit",
      description: "",
      transform: eachFile(async (file) => {
        file.replaceWithText(await readFile(join(dir, "replacement.txt"), "utf8"));
        return true;
      }),
    });
    const result = await runCodemod(codemod, { path: dir });
    expect(result.changed).toEqual([join(dir, "index.ts")]);
    expect(await readFile(join(dir, "index.ts"), "utf8")).toBe('export const value = "after";\n');
  });

  it("does not save source edits when an asynchronous transform rejects", async () => {
    const dir = await scratch();
    const original = 'export const value = "before";\n';
    await write(dir, "index.ts", original);
    const codemod = defineCodemod({
      version: "10.36.0",
      name: "async-failure",
      description: "",
      transform: eachFile(async (file) => {
        file.replaceWithText('export const value = "after";');
        await readFile(join(dir, "missing.txt"), "utf8");
        return true;
      }),
    });
    await expect(runCodemod(codemod, { path: dir })).rejects.toThrow("ENOENT");
    expect(await readFile(join(dir, "index.ts"), "utf8")).toBe(original);
  });

  it("rejects a missing path", async () => {
    await expect(runCodemod(shout, { path: join(await scratch(), "nope") })).rejects.toThrow(
      "Path not found",
    );
  });
});
