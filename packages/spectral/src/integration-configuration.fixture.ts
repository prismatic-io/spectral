import { z } from "zod";

import {
  configuration,
  connectionConfigVar,
  customerActivatedConnection,
  flow,
  integration,
  organizationActivatedConnection,
  serverFunction,
  userActivatedConnection,
} from ".";

/**
 * The fixture the integration configuration tests convert, kept close to what an author
 * would write. The tests assert over what `integration()` emits from it.
 */

export const ORG_CONNECTION_STABLE_KEY = "integration-config-org-slack";
export const CUSTOMER_CONNECTION_STABLE_KEY = "integration-config-customer-salesforce";
export const INLINE_CONNECTION_STABLE_KEY = "integration-config-inline-acme";
export const USER_CONNECTION_STABLE_KEY = "integration-config-user-slack";

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

export const CONFIGURATION_VERSION = "config-v2";
export const PREVIOUS_CONFIGURATION_VERSION = "config-v1";
export const USER_CONFIGURATION_VERSION = "user-v2";
export const PREVIOUS_USER_CONFIGURATION_VERSION = "user-v1";
export const userConfigurationSchema = z.object({ channel: z.string() });
export const previousUserConfigurationSchema = z.object({ channelId: z.string() });

/** A v1 value stored its rows under `pairs`; v2 calls them `mappings`. */
export const previousConfigurationSchema = z.object({
  pairs: z.array(z.object({ source: z.string(), destination: z.string() })),
});

/** The shape an instance's `configPages` values arrive in, before a first deploy. */
export const configPagesSchema = z.object({
  pairs: z.array(z.object({ source: z.string(), destination: z.string() })).optional(),
});

export const versionSchemas = {
  [PREVIOUS_CONFIGURATION_VERSION]: previousConfigurationSchema,
};

const syncFlow = flow({
  name: "Sync Records",
  stableKey: "sync-records",
  description: "Syncs mapped records on a schedule",
  onExecution: async (context) => {
    // `configuration` and `connections` reach a flow only once an integration
    // augments `Experimental`, which is global to a compilation and so cannot
    // happen here without reaching the rest of the suite.
    const { configuration, userConfiguration, connections } = context as typeof context & {
      configuration?: { mappings?: Array<{ source: string }> };
      userConfiguration?: { channel?: string };
      connections?: {
        instance?: Record<string, unknown>;
        userLevel?: Record<string, unknown>;
      };
    };

    return {
      data: {
        count: configuration?.mappings?.length ?? 0,
        channel: userConfiguration?.channel,
        connectionNames: Object.entries(connections ?? {}).flatMap(([scope, values]) =>
          Object.keys(values).map((name) => `${scope}.${name}`),
        ),
      },
    };
  },
});

export const searchChannels = serverFunction({
  inputSchema: z.object({ search: z.string() }),
  outputSchema: z.array(z.object({ id: z.string(), name: z.string() })),
  connections: ["instance.orgConnection"],
  label: "Search Channels",
  description: "Lists channels matching a search string",
  perform: async ({ connections }, { search }) => {
    const names = Object.keys(connections.instance);
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
    instance: {
      schema: configurationSchema,
      ui: { type: "uiSchema", value: configurationUiSchema },
      version: CONFIGURATION_VERSION,
      versionSchemas,
      configPagesSchema,
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
    },
    userLevel: {
      schema: userConfigurationSchema,
      version: USER_CONFIGURATION_VERSION,
      versionSchemas: {
        [PREVIOUS_USER_CONFIGURATION_VERSION]: previousUserConfigurationSchema,
      },
      configPagesSchema: z.object({ channelId: z.string().optional() }),
      connections: {
        orgConnection: userActivatedConnection({ stableKey: USER_CONNECTION_STABLE_KEY }),
      },
    },
    init: {
      connections: ["instance.orgConnection", "userLevel.orgConnection"],
      perform: async (context) => {
        if (context.configurationVersion === null) {
          return {
            previousValues: context.configuration,
            migratedValues: { mappings: context.configuration?.pairs ?? [] },
            configurationVersion: context.configurationVersion,
          };
        }
        if (context.configurationVersion === PREVIOUS_CONFIGURATION_VERSION) {
          return {
            previousValues: context.configuration,
            migratedValues: { mappings: context.configuration.pairs },
            configurationVersion: context.configurationVersion,
          };
        }
        if (context.configurationVersion === CONFIGURATION_VERSION) {
          return {
            previousValues: context.configuration,
            migratedValues: context.configuration,
            configurationVersion: context.configurationVersion,
          };
        }
        return {
          previousValues: context.configuration,
          migratedValues: { mappings: [] },
          configurationVersion: context.configurationVersion,
        };
      },
    },
    serverFunctions: { searchChannels, listRegions },
  }),
} as const;

export const configuredIntegration = integration(integrationConfigurationDefinition as never);

/** A minimal definition with no `init` and no `ui`, to assert the defaults. */
export const noInitDefinition = {
  name: "Integration Configuration Without Init",
  description: "Fixture for the no-init path",
  flows: [syncFlow],
  configuration: configuration({
    instance: {
      schema: literalSchema,
      version: CONFIGURATION_VERSION,
    },
  }),
} as const;

export const noInitIntegration = integration(noInitDefinition as never);
