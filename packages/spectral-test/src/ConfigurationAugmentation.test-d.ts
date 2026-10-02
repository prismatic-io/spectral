import type {
  ConfiguredConnections,
  ConfiguredUserValue,
  ConfiguredValue,
  Connection,
  IntegrationConfigurationContext,
} from "@prismatic-io/spectral";
import {
  configuration,
  organizationActivatedConnection,
  userActivatedConnection,
} from "@prismatic-io/spectral";
import type { InvokeFlowConfiguration } from "@prismatic-io/spectral/dist/testing";
import { expectType } from "tsd";

const definition = configuration({
  instance: {
    schema: {
      type: "object",
      properties: { region: { type: "string" } },
      required: ["region"],
      additionalProperties: false,
    },
    version: "instance-v1",
    connections: {
      airtable: organizationActivatedConnection({ stableKey: "organization-airtable" }),
    },
  },
  userLevel: {
    schema: {
      type: "object",
      properties: { locale: { type: "string" } },
      required: ["locale"],
      additionalProperties: false,
    },
    version: "user-v1",
    connections: {
      airtable: userActivatedConnection({ stableKey: "personal-airtable" }),
    },
  },
});

type Definition = typeof definition;

declare module "@prismatic-io/spectral" {
  interface IntegrationDefinitionConfiguration extends Definition {}
}

declare const validatedUserValue: ConfiguredUserValue;
declare const validatedInstanceValue: ConfiguredValue;
declare const connections: ConfiguredConnections;
expectType<{ locale: string }>(validatedUserValue);
expectType<{ region: string }>(validatedInstanceValue);
expectType<Connection>(connections.instance.airtable);
expectType<Connection>(connections.userLevel.airtable);
// @ts-expect-error only declared connection names are exposed after augmentation
connections.userLevel.warehouse;

// An execution context carries the same types once the flag is on. The flag itself is
// global to a compilation, so the gated shape is asserted directly.
declare const executionContext: IntegrationConfigurationContext;
expectType<{ locale: string } | undefined>(executionContext.userConfiguration);
expectType<{ region: string } | undefined>(executionContext.configuration);
expectType<Connection | undefined>(executionContext.connections?.userLevel?.airtable);

// invokeFlow takes the same configuration once the flag is on, and no config vars.
declare const invokeFlowConfiguration: InvokeFlowConfiguration;
expectType<{ region?: string } | undefined>(invokeFlowConfiguration.configuration);
expectType<{ locale?: string } | undefined>(invokeFlowConfiguration.userConfiguration);
expectType<undefined>(invokeFlowConfiguration.configVars);
export const invokeFlowConnections: InvokeFlowConfiguration["connections"] = {
  instance: { airtable: { key: "airtable", fields: { apiKey: "key" } } },
  userLevel: { airtable: { key: "airtable", fields: {}, token: { access_token: "token" } } },
};
export const undeclaredConnection: InvokeFlowConfiguration["connections"] = {
  // @ts-expect-error only declared connection names are accepted after augmentation
  userLevel: { warehouse: { key: "warehouse", fields: {} } },
};
export const missingKey: InvokeFlowConfiguration["connections"] = {
  // @ts-expect-error a test connection names its connection type, as in configVars
  instance: { airtable: { fields: {} } },
};
