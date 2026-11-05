import { expect, test } from "vitest";
import * as api from "./index";

test("exports the npm build spectral's packaging writes and the helper its hooks become", () => {
  expect(api.NPM_BUILD).toContain('entry: { index: "npm-dist/.entry.ts" }');
  expect(api.PRISM_NPM_BUILD).toContain('entry: { index: "npm-dist/.entry.ts" }');
  expect(api.HOOKS_NPM_BUILD).toContain(`hooks: ${api.CALLABLE_ENTRY_HOOKS}(),`);
  expect(api.CALLABLE_ENTRY_HOOKS).toBe("callableEntryHooks");
  expect(api.SPECTRAL_TSDOWN).toBe("@prismatic-io/spectral/tsdown");
});
