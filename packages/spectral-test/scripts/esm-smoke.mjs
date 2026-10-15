// Native ESM smoke test for @prismatic-io/spectral's entry points. Runs against the
// built package through the workspace link, with Node's own resolver (no bundler), so
// it fails if the `exports` map is missing an entry or points at a file that does not exist.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import {
  component,
  conditionalLogic,
  findUserDefinedComponentKey,
  flow,
  requireContext,
  requireIntegrationContext,
} from "@prismatic-io/spectral";
// Deprecated deep imports must keep resolving.
// biome-ignore lint/style/noRestrictedImports: this smoke test checks the deprecated dist/ paths still resolve.
import { handleErrors as handleErrorsDeep } from "@prismatic-io/spectral/dist/clients/http";
// biome-ignore lint/style/noRestrictedImports: this smoke test checks the deprecated dist/ paths still resolve.
import * as testingDeep from "@prismatic-io/spectral/dist/testing";
import { createClient, handleErrors } from "@prismatic-io/spectral/http";
import { createConnection, invoke, invokeFlow } from "@prismatic-io/spectral/testing";

for (const [name, value] of Object.entries({
  component,
  createClient,
  handleErrors,
  createConnection,
  invoke,
  requireContext,
  requireIntegrationContext,
  findUserDefinedComponentKey,
  "conditionalLogic.isEqual": conditionalLogic.isEqual,
  "conditionalLogic.evaluate": conditionalLogic.evaluate,
})) {
  if (typeof value !== "function") throw new Error(`${name} did not import as a function`);
}
if (
  handleErrorsDeep !== handleErrors ||
  testingDeep.invoke !== invoke ||
  testingDeep.invokeFlow !== invokeFlow
) {
  throw new Error(
    "deprecated dist/ entry points resolve to different modules than the public ones",
  );
}

// Every exports target must exist in the built package.
const require = createRequire(import.meta.url);
const { invokeFlow: invokeFlowCjs } = require("@prismatic-io/spectral/testing");
const { requireContext: requireContextCjs } = require("@prismatic-io/spectral");

// The harness and manifest helpers must share storage across supported entry points.
for (const invokeTestFlow of [invokeFlow, testingDeep.invokeFlow, invokeFlowCjs]) {
  const components = { fixture: { echo: async () => ({ data: "mock" }) } };
  const check = async (context) => {
    await Promise.resolve();
    assert.equal(requireContext(), context);
    assert.equal(requireContextCjs(), context);
    assert.equal(context.components, components);
    return requireContext().components.fixture.echo();
  };
  const tested = flow({
    name: "Harness import smoke",
    stableKey: "harness-import-smoke",
    onTrigger: async (context, payload) => {
      assert.deepEqual(await check(context), { data: "mock" });
      return { payload };
    },
    onExecution: check,
  });

  assert.deepEqual((await invokeTestFlow(tested, { context: { components } })).result, {
    data: "mock",
  });
  assert.throws(requireContext, /ActionContext not found/);
}

const packageJsonPath = require.resolve("@prismatic-io/spectral/package.json");
const { exports: exportsMap } = require(packageJsonPath);
const packageDir = dirname(packageJsonPath);
const targets = Object.values(exportsMap).flatMap((entry) =>
  typeof entry === "string" ? [entry] : Object.values(entry),
);
const missing = targets.filter((target) => !existsSync(join(packageDir, target)));
if (missing.length > 0) throw new Error(`exports targets missing from dist: ${missing.join(", ")}`);

console.log(`esm smoke ok (${Object.keys(exportsMap).length} export entries, all targets present)`);
