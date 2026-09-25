import { z } from "zod";

import {
  configuration,
  connectionConfigVar,
  customerActivatedConnection,
  flow,
  integration,
  organizationActivatedConnection,
  serverFunction,
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

/** A v1 value stored its rows under `pairs`; v2 calls them `mappings`. */
export const previousConfigurationSchema = z.object({
  pairs: z.array(z.object({ source: z.string(), destination: z.string() })),
});

/** The shape an instance's `configPages` values arrive in, before a first deploy. */
export const configPagesSchema = z.object({
  pairs: z.array(z.object({ source: z.string(), destination: z.string() })).optional(),
});

export const eTagSchemas = {
  [PREVIOUS_CONFIGURATION_E_TAG]: previousConfigurationSchema,
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

export const searchChannels = serverFunction({
  inputSchema: z.object({ search: z.string() }),
  outputSchema: z.array(z.object({ id: z.string(), name: z.string() })),
  connections: ["orgConnection"],
  label: "Search Channels",
  description: "Lists channels matching a search string",
  perform: async ({ connections }, { search }) => {
    const names = Object.keys(connections);
    return names.filter((name) => name.includes(search)).map((name) => ({ id: name, name }));
  },
});

/** No label or description, to assert what the convert layer substitutes. */
export const listRegions = serverFunction({
  inputSchema: z.object({}),
  outputSchema: z.array(z.string()),
  perform: async () => ["us-east-1", "us-west-2"],
});

export const integrationConfigurationDefinition = {
  name: "Integration Configuration",
  description: "Fixture for integration configuration",
  flows: [syncFlow],
  configuration: configuration({
    schema: configurationSchema,
    uiSchema: configurationUiSchema,
    eTag: CONFIGURATION_E_TAG,
    eTagSchemas,
    configPagesSchema,
    /**
     * Seeds on a first run and migrates a stale one, branching on the etag the
     * instance has deployed. Returns the author's own shape, not the
     * configuration value.
     *
     * Every branch reads `configuration` without a cast: the etag narrows it to
     * the schema it was written under.
     */
    init: async ({ configuration: previousValues, configurationEtag }) => {
      if (configurationEtag === null) {
        // Nothing deployed: either a new instance, or config vars to migrate.
        return {
          previousValues,
          migratedValues: { mappings: previousValues?.pairs ?? [] },
          configurationEtag,
        };
      }

      if (configurationEtag === PREVIOUS_CONFIGURATION_E_TAG) {
        return {
          previousValues,
          migratedValues: { mappings: previousValues.pairs },
          configurationEtag,
        };
      }

      if (configurationEtag === CONFIGURATION_E_TAG) {
        // Already the current shape.
        return { previousValues, migratedValues: previousValues, configurationEtag };
      }

      // An etag nobody declared.
      return { previousValues, migratedValues: { mappings: [] }, configurationEtag };
    },
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
    serverFunctions: { searchChannels, listRegions },
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
