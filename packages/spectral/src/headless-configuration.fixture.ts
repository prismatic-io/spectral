import { z } from "zod";

import {
  configuration,
  customerActivatedConnection,
  flow,
  type HeadlessInitContext,
  integration,
  organizationActivatedConnection,
} from ".";

/**
 * The fixture the headless configuration tests convert, kept close to what an author
 * would write. The tests assert over what `integration()` emits from it.
 */

export const ORG_CONNECTION_STABLE_KEY = "headless-org-slack";
export const CUSTOMER_CONNECTION_STABLE_KEY = "headless-customer-salesforce";

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
export const headlessInit = async ({
  configuration: previousValues,
  configurationEtag,
}: HeadlessInitContext) => {
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
    // Ordinary property access on a value the flow already holds. Nothing is
    // serialized and no reference is resolved.
    const config = context.configuration as { mappings?: Array<{ source: string }> };
    return {
      data: {
        count: config.mappings?.length ?? 0,
        connectionNames: Object.keys(context.connections ?? {}),
      },
    };
  },
});

export const headlessConfigurationDefinition = {
  name: "Headless Configuration",
  description: "Fixture for the function-backed configuration",
  flows: [syncFlow],
  configuration: configuration({
    schema: configurationSchema,
    uiSchema: configurationUiSchema,
    eTag: CONFIGURATION_E_TAG,
    init: headlessInit,
    connections: {
      orgConnection: organizationActivatedConnection({
        stableKey: ORG_CONNECTION_STABLE_KEY,
      }),
      customerConnection: customerActivatedConnection({
        stableKey: CUSTOMER_CONNECTION_STABLE_KEY,
      }),
    },
  }),
} as const;

export const headlessConfigurationIntegration = integration(
  headlessConfigurationDefinition as never,
);

/** A minimal definition with no `init` and no `uiSchema`, to assert the defaults. */
export const noInitDefinition = {
  name: "Headless Configuration Without Init",
  description: "Fixture for the no-init path",
  flows: [syncFlow],
  configuration: configuration({
    schema: literalSchema,
    eTag: CONFIGURATION_E_TAG,
  }),
} as const;

export const noInitIntegration = integration(noInitDefinition as never);
