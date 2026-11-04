/**
 * Build helpers for a component's tsdown config. Import them from
 * `@prismatic-io/spectral/tsdown`.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** The entry the npm build bundles; the hooks write it before the build and remove it after. */
export const CALLABLE_ENTRY = "npm-dist/.entry.ts";

const CALLABLE_ENTRY_SOURCE = [
  'import { callableComponent } from "@prismatic-io/spectral";',
  'import component from "../src/index";',
  "export default callableComponent(component);",
  "",
].join("\n");

/**
 * tsdown hooks for a component's npm build, whose entry is {@link CALLABLE_ENTRY}: it
 * wraps the component's default export in `callableComponent`, so code-native
 * integrations can call its actions, triggers and data sources. In watch mode the entry
 * stays, so rebuilds can read it.
 *
 * ```ts
 * import { callableEntryHooks } from "@prismatic-io/spectral/tsdown";
 *
 * export default defineConfig([
 *   { ... }, // the platform build
 *   { entry: { index: "npm-dist/.entry.ts" }, ..., hooks: callableEntryHooks() },
 * ]);
 * ```
 */
export const callableEntryHooks = () => ({
  "build:before": async (): Promise<void> => {
    await mkdir(dirname(CALLABLE_ENTRY), { recursive: true });
    await writeFile(CALLABLE_ENTRY, CALLABLE_ENTRY_SOURCE);
  },
  "build:done": async ({ options }: { options: { watch?: unknown } }): Promise<void> => {
    if (!options.watch) await rm(CALLABLE_ENTRY, { force: true });
  },
});
