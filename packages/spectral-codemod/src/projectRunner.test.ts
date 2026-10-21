import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { defineCodemod, type ProjectCodemod } from "./codemod";
import { runCodemod } from "./runner";

const dirs: string[] = [];
const scratch = async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "project-codemod-")));
  dirs.push(dir);
  return dir;
};
const migration = (plan: ProjectCodemod["plan"]) =>
  defineCodemod({
    version: "10.36.0",
    name: "project",
    description: "Project files",
    plan,
  });
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe("project migrations", () => {
  it("stages new files, updates only changed content, and does not create directories in dry runs", async () => {
    const dir = await scratch();
    await writeFile(join(dir, "package.json"), "original");
    const mod = migration(async (files) => {
      expect(await files.read("missing.json")).toBeUndefined();
      return [
        { path: "package.json", content: (await files.read("package.json")) ?? "" },
        { path: "config/build.ts", content: "export default {};\n" },
      ];
    });
    expect((await runCodemod(mod, { path: dir, dryRun: true })).changed).toEqual([
      join(dir, "config/build.ts"),
    ]);
    expect(existsSync(join(dir, "config"))).toBe(false);
    expect((await runCodemod(mod, { path: dir })).changed).toEqual([join(dir, "config/build.ts")]);
    expect(await readFile(join(dir, "config/build.ts"), "utf8")).toBe("export default {};\n");
    expect((await runCodemod(mod, { path: dir })).changed).toEqual([]);
  });

  it("does not write earlier edits when a later destination is invalid", async () => {
    const dir = await scratch();
    const mod = migration(async () => [
      { path: "package.json", content: "{}" },
      { path: "../outside.json", content: "{}" },
    ]);
    await expect(runCodemod(mod, { path: dir })).rejects.toThrow("inside the project directory");
    expect(existsSync(join(dir, "package.json"))).toBe(false);
  });

  it("rejects reads and writes through symlinks outside the project", async () => {
    const dir = await scratch();
    const outside = await scratch();
    await writeFile(join(outside, "package.json"), "original");
    await symlink(outside, join(dir, "linked"));
    await expect(
      runCodemod(
        migration(async (files) => {
          await files.read("linked/package.json");
          return [];
        }),
        { path: dir },
      ),
    ).rejects.toThrow("outside the project directory");
    await expect(
      runCodemod(
        migration(async () => [{ path: "linked/new.json", content: "{}" }]),
        { path: dir },
      ),
    ).rejects.toThrow("outside the project directory");
    expect(existsSync(join(outside, "new.json"))).toBe(false);
  });

  it("rejects duplicate destinations before writing", async () => {
    const dir = await scratch();
    await expect(
      runCodemod(
        migration(async () => [
          { path: "package.json", content: "first" },
          { path: "./package.json", content: "second" },
        ]),
        { path: dir },
      ),
    ).rejects.toThrow("Duplicate project file edits");
    expect(existsSync(join(dir, "package.json"))).toBe(false);
  });
  it.each([
    false,
    true,
  ])("rejects parent/child destinations before writing (reverse: %s)", async (reverse) => {
    const dir = await scratch();
    const edits = [
      { path: "config", content: "file" },
      { path: "config/build.json", content: "{}" },
    ];
    if (reverse) edits.reverse();
    await expect(
      runCodemod(
        migration(async () => edits),
        { path: dir },
      ),
    ).rejects.toThrow("Conflicting project file edits");
    expect(existsSync(join(dir, "config"))).toBe(false);
  });

  it("rejects conflicting destinations even when one edit is unchanged", async () => {
    const dir = await scratch();
    await writeFile(join(dir, "package.json"), "original");
    await symlink("package.json", join(dir, "alias.json"));
    await expect(
      runCodemod(
        migration(async () => [
          { path: "package.json", content: "original" },
          { path: "alias.json", content: "changed" },
        ]),
        { path: dir },
      ),
    ).rejects.toThrow("Duplicate project file edits");
    expect(await readFile(join(dir, "package.json"), "utf8")).toBe("original");
  });

  it("rejects new files aliased through a symlinked parent", async () => {
    const dir = await scratch();
    await mkdir(join(dir, "config"));
    await symlink("config", join(dir, "alias"));
    await expect(
      runCodemod(
        migration(async () => [
          { path: "config/new.json", content: "first" },
          { path: "alias/new.json", content: "second" },
        ]),
        { path: dir },
      ),
    ).rejects.toThrow("Duplicate project file edits");
    expect(existsSync(join(dir, "config/new.json"))).toBe(false);
  });

  it("requires a project directory", async () => {
    const dir = await scratch();
    const path = join(dir, "index.ts");
    await writeFile(path, "export default {};\n");
    await expect(
      runCodemod(
        migration(async () => []),
        { path },
      ),
    ).rejects.toThrow("project directory");
  });
});
