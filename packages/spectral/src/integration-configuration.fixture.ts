import { z } from "zod";

import {
  type ConfigurationInitContext,
  configuration,
  connectionConfigVar,
  customerActivatedConnection,
  flow,
  integration,
  organizationActivatedConnection,
} from ".";

/**
 * The fixture the integration configuration tests convert, kept close to what an author
 * would write. The tests assert over what `integration()` emits from it.
 */

export const ORG_CONNECTION_STABLE_KEY = "integration-config-org-slack";
export const CUSTOMER_CONNECTION_STABLE_KEY = "integration-config-customer-salesforce";
export const INLINE_CONNECTION_STABLE_KEY = "integration-config-inline-acme";

/** The configuration schema, authored in zod — the recommended path. */
export const configurationSchema = z.object({
  mappings: z.array(
    z.object({
      source: z.string(),
      destination: z.string(),
    }),
  ),
});

export type Configuration = z.infer<typeof configurationSchema>;

/** A JSON Forms layout: that is the dialect the platform renders. */
export const configurationUiSchema = {
  type: "VerticalLayout",
  elements: [{ type: "Control", scope: "#/properties/mappings" }],
} as const;

/** A hand-written JSON Schema, to prove the literal path still works. */
export const literalSchema = {
  type: "object",
  required: ["objectKey"],
  properties: {
    objectKey: { type: "string" },
  },
  additionalProperties: false,
} as const;

export const CONFIGURATION_E_TAG = "config-v2";
export const PREVIOUS_CONFIGURATION_E_TAG = "config-v1";

/**
 * Seeds on a first run and migrates a stale one, branching on the etag the
 * instance has deployed. Returns the author's own shape, not the configuration
 * value.
 */
export const configurationInit = async ({
  configuration: previousValues,
  configurationEtag,
}: ConfigurationInitContext) => {
  if (!previousValues) {
    return { previousValues: undefined, migratedValues: { mappings: [] } };
  }

  // A v1 value stored its rows under `pairs`; v2 calls them `mappings`.
  const stale = previousValues as
    | { readonly pairs?: readonly unknown[]; readonly mappings?: readonly unknown[] }
    | undefined;
  const migratedValues =
    configurationEtag === CONFIGURATION_E_TAG
      ? stale
      : { mappings: stale?.pairs ?? stale?.mappings ?? [] };

  // The return is the author's own shape, so it can carry more than the value.
  return { previousValues, migratedValues, configurationEtag };
};

const syncFlow = flow({
  name: "Sync Records",
  stableKey: "sync-records",
  description: "Syncs mapped records on a schedule",
  onExecution: async (context) => {
    // `configuration` and `connections` reach a flow only once an integration
    // augments `Experimental`, which is global to a compilation and so cannot
    // happen here without reaching the rest of the suite.
    const { configuration, connections } = context as typeof context & {
      configuration?: { mappings?: Array<{ source: string }> };
      connections?: Record<string, unknown>;
    };

    return {
      data: {
        count: configuration?.mappings?.length ?? 0,
        connectionNames: Object.keys(connections ?? {}),
      },
    };
  },
});

export const integrationConfigurationDefinition = {
  name: "Integration Configuration",
  description: "Fixture for integration configuration",
  flows: [syncFlow],
  configuration: configuration({
    schema: configurationSchema,
    uiSchema: configurationUiSchema,
    eTag: CONFIGURATION_E_TAG,
    init: configurationInit,
    connections: {
      orgConnection: organizationActivatedConnection({
        stableKey: ORG_CONNECTION_STABLE_KEY,
      }),
      customerConnection: customerActivatedConnection({
        stableKey: CUSTOMER_CONNECTION_STABLE_KEY,
      }),
      // Integration-specific: carries its own inputs, so the platform collects
      // them and the generated component owns the connection.
      inlineConnection: connectionConfigVar({
        stableKey: INLINE_CONNECTION_STABLE_KEY,
        dataType: "connection",
        inputs: {
          apiKey: { label: "API Key", type: "password", required: true },
          endpoint: { label: "Endpoint", type: "string", default: "https://api.acme.test" },
        },
      }),
    },
  }),
} as const;

export const configuredIntegration = integration(integrationConfigurationDefinition as never);

/** A minimal definition with no `init` and no `uiSchema`, to assert the defaults. */
export const noInitDefinition = {
  name: "Integration Configuration Without Init",
  description: "Fixture for the no-init path",
  flows: [syncFlow],
  configuration: configuration({
    schema: literalSchema,
    eTag: CONFIGURATION_E_TAG,
  }),
} as const;

export const noInitIntegration = integration(noInitDefinition as never);
