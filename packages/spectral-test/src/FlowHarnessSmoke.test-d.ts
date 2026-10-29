import { flow } from "@prismatic-io/spectral";
import { createHarness } from "@prismatic-io/spectral/testing";
import { expectError, expectType } from "tsd";

const harness = createHarness(
  flow({
    name: "Typed run",
    stableKey: "typed-run",
    onExecution: async () => ({ data: { count: 1 } }),
  }),
);

harness.run().then(({ result }) => {
  expectType<{ data: { count: number } }>(result);
  expectError(result.data.missing);
});
