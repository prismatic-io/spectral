import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CALLABLE_ENTRY, callableEntryHooks } from "./tsdown";

describe("callableEntryHooks", () => {
  const cwd = process.cwd();
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "callable-entry-"));
    process.chdir(dir);
  });
  afterEach(async () => {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  });

  const exists = (path: string) =>
    readFile(path).then(
      () => true,
      () => false,
    );

  it("writes an entry that wraps the component before the build and removes it after", async () => {
    const hooks = callableEntryHooks();
    await hooks["build:before"]();
    expect(await readFile(CALLABLE_ENTRY, "utf8")).toBe(
      [
        'import { callableComponent } from "@prismatic-io/spectral";',
        'import component from "../src/index";',
        "export default callableComponent(component);",
        "",
      ].join("\n"),
    );
    await hooks["build:done"]({ options: { watch: false } });
    expect(await exists(CALLABLE_ENTRY)).toBe(false);
  });

  it("keeps the entry in watch mode, so rebuilds can read it", async () => {
    const hooks = callableEntryHooks();
    await hooks["build:before"]();
    await hooks["build:done"]({ options: { watch: true } });
    expect(await exists(CALLABLE_ENTRY)).toBe(true);
  });
});
