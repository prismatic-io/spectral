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
