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

harness.run().then((run) => {
  expectType<{ data: { count: number } }[]>(run.results);
  if (run.status === "completed") {
    expectType<{ data: { count: number } }>(run.result);
    expectError(run.result.data.missing);
  } else {
    expectType<undefined>(run.result);
  }
});
expectType<
  Promise<
    import("@prismatic-io/spectral/testing").FlowHarnessRunResult<{ data: { count: number } }>
  >
>(harness.initialSync());
expectError(harness.run({ maxPages: "100" }));
expectError(harness.run({ concurrency: "2" }));
