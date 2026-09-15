import type { Connection } from "../types/Inputs";
import type { ConfigurationContext } from "../types/IntegrationConfiguration";

/** Builds the context an author function sees. */

/**
 * Author's connection name -> its key in the runtime `configVars` bag.
 * Identical today, but this is what marks an entry as a connection.
 */
export type ConnectionNameMap = Record<string, string>;

type PlatformContext = Partial<Pick<ConfigurationContext, "logger" | "customer" | "instance">> & {
  configVars?: Record<string, unknown>;
};

const asPlatformContext = (context: unknown): PlatformContext =>
  context && typeof context === "object" ? (context as PlatformContext) : {};

/** Unresolved connections are absent, so `Object.keys` reports what is usable. */
export const createConfigurationConnections = (
  connectionNames: ConnectionNameMap,
  configVars: Record<string, unknown> | undefined,
): Record<string, Connection> =>
  Object.entries(connectionNames).reduce<Record<string, Connection>>((acc, [name, key]) => {
    const value = configVars?.[key];
    if (value && typeof value === "object") {
      acc[name] = value as Connection;
    }
    return acc;
  }, {});

export const createConfigurationContext = <TConfiguration>(
  context: unknown,
  connectionNames: ConnectionNameMap,
  configuration: TConfiguration,
): ConfigurationContext<TConfiguration> => {
  const { logger, customer, instance, configVars } = asPlatformContext(context);

  return {
    logger: logger as ConfigurationContext["logger"],
    customer,
    instance,
    connections: createConfigurationConnections(connectionNames, configVars),
    configuration,
  };
};
