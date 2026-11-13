// An integration without config-var types: every config var can be a string or a
// connection.
import { flow } from "@prismatic-io/spectral";
import { createHarness, invokeFlow } from "@prismatic-io/spectral/testing";

const tested = flow({
  name: "Open",
  stableKey: "open",
  onExecution: async () => ({ data: null }),
});
const connection = { key: "dropbox", fields: { token: "secret" } };
const harness = createHarness(tested);

harness.run({ configVars: { "Dropbox Connection": connection, "API Key": "key" } });
harness.initialSync({ configVars: { "Dropbox Connection": connection } });
harness.run({ configVars: { "Dropbox Connection": null } });
invokeFlow(tested, { configVars: { "Dropbox Connection": connection, "API Key": "key" } });
invokeFlow(tested, { configVars: { "Dropbox Connection": null } });

// @ts-expect-error a config var is a string or a connection
harness.run({ configVars: { Count: 3 } });
