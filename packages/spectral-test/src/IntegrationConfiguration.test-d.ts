import type {
  ActionContext,
  ConfiguredUserValue,
  ConfiguredValue,
  IntegrationConfigurationContext,
} from "@prismatic-io/spectral";
import { expectType } from "tsd";

/**
 * Configuration is available without augmenting Experimental. Other tests augment
 * IntegrationDefinitionConfiguration to verify schema-specific values.
 */
type Keys = keyof ActionContext;

expectType<"configuration">(null as unknown as Extract<Keys, "configuration">);
expectType<"userConfiguration">(null as unknown as Extract<Keys, "userConfiguration">);
expectType<"connections">(null as unknown as Extract<Keys, "connections">);
expectType<"configVars">(null as unknown as Extract<Keys, "configVars">);

declare const context: ActionContext;
expectType<ConfiguredValue | undefined>(context.configuration);
expectType<ConfiguredUserValue | undefined>(context.userConfiguration);
expectType<IntegrationConfigurationContext["connections"]>(context.connections);
