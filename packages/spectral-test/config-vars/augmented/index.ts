// An integration that declares its config-var types: each config var takes a value of
// its kind.
import {
  type ConfigVars,
  configPage,
  configVar,
  connectionConfigVar,
  flow,
} from "@prismatic-io/spectral";
import { createHarness, invokeFlow } from "@prismatic-io/spectral/testing";

export const configPages = {
  Connections: configPage({
    elements: {
      "Dropbox Connection": connectionConfigVar({
        stableKey: "dropbox-connection",
        dataType: "connection",
        inputs: { token: { label: "Token", type: "string", required: true } },
      }),
      "API Key": configVar({ stableKey: "api-key", dataType: "string" }),
    },
  }),
};

type TConfigPages = typeof configPages;
declare module "@prismatic-io/spectral" {
  interface IntegrationDefinitionConfigPages extends TConfigPages {}
}

const tested = flow({
  name: "Augmented",
  stableKey: "augmented",
  onExecution: async () => ({ data: null }),
});
const connection = { key: "dropbox", fields: { token: "secret" } };
const harness = createHarness(tested);

harness.run({ configVars: { "Dropbox Connection": connection, "API Key": "key" } });
harness.initialSync({ configVars: { "Dropbox Connection": connection } });
// A test gives only the config vars that the flow reads.
harness.run({ configVars: { "API Key": "key" } });
harness.run({ configVars: { "Dropbox Connection": null } });
invokeFlow<never, never, ConfigVars>(tested, {
  configVars: { "Dropbox Connection": connection },
});

// The harness uses the integration's config-var types without a type argument.
// @ts-expect-error a connection config var does not take a string
harness.run({ configVars: { "Dropbox Connection": "secret" } });
// @ts-expect-error a string config var does not take a connection
harness.run({ configVars: { "API Key": connection } });
// @ts-expect-error a config var that the integration does not declare
harness.run({ configVars: { "Missing Key": "key" } });
