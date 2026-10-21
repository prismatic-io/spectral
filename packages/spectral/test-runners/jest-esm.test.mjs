import { expect, test } from "@jest/globals";
import { flow } from "@prismatic-io/spectral";
import { createHarness } from "@prismatic-io/spectral/testing";
import { crm, onboard } from "./node_modules/.cache/callable-fixture/component.mjs";

// Jest's VM ESM loader is a separate compatibility boundary. Generic behavior is
// tested once in source; native adapters have shared Vitest/Jest CJS/Bun contracts.
test("public ESM imports intercept a bundled component and expose native Jest assertions", async () => {
  const tested = flow({
    name: "ESM onboarding",
    stableKey: "esm-onboarding",
    onExecution: () => onboard("new@example.com"),
  });

  const automatic = createHarness(tested);

  expect((await automatic.run()).result).toEqual({ data: { id: "contact-example" } });

  const overridden = createHarness(tested);
  const mock = overridden.mock(crm.actions.createContact);
  mock.mockResolvedValueOnce({ data: { id: "specific" } });

  expect((await overridden.run()).result).toEqual({ data: { id: "specific" } });
  expect(mock).toHaveBeenCalledTimes(1);
  expect(mock).toHaveBeenCalledWith({ email: "new@example.com" });
  expect(overridden.mock(crm.actions.createContact)).toBe(mock);
});
