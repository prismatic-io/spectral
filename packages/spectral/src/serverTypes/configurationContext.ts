import type { ConfigurationContext } from "../types/IntegrationConfiguration";

/** Builds the context an author function sees. */

/**
 * Author's connection name -> its key in the runtime `configVars` bag.
 * Identical today, but this is what marks an entry as a connection.
 */
export type ConnectionNameMap = Record<string, string>;

type PlatformContext = Partial<Pick<ConfigurationContext, "logger" | "customer" | "instance">> & {
  configVars?: Record<string, unknown>;
  connections?: Record<string, unknown>;
  configuration?: unknown;
  userConfiguration?: unknown;
  user?: ConfigurationContext["user"];
};

const asPlatformContext = (context: unknown): PlatformContext =>
  context && typeof context === "object" ? (context as PlatformContext) : {};

/** Unresolved connections are absent, so `Object.keys` reports what is usable. */
export const createConfigurationConnections = (
  connectionNames: ConnectionNameMap,
  configVars: Record<string, unknown> | undefined,
): ConfigurationContext["connections"] =>
  Object.entries(connectionNames).reduce<ConfigurationContext["connections"]>(
    (acc, [name, key]) => {
      const separator = name.indexOf(".");
      const scope = name.slice(0, separator);
      const localName = name.slice(separator + 1);
      if ((scope !== "instance" && scope !== "userLevel") || !localName) {
        throw new Error(`Invalid qualified connection key: "${name}"`);
      }
      const value = configVars && Object.hasOwn(configVars, key) ? configVars[key] : undefined;
      if (value && typeof value === "object") {
        const scoped = Object.hasOwn(acc, scope) ? acc[scope] : Object.create(null);
        Object.defineProperty(scoped, localName, { value, enumerable: true, configurable: true });
        acc[scope] = scoped;
      }
      return acc;
    },
    {} as ConfigurationContext["connections"],
  );

export const createConfigurationContext = <TConfiguration>(
  context: unknown,
  connectionNames: ConnectionNameMap,
  configuration?: TConfiguration,
): ConfigurationContext<TConfiguration> => {
  const platform = asPlatformContext(context);
  const { logger, customer, instance, configVars, connections, user, userConfiguration } = platform;

  return {
    logger: logger as ConfigurationContext["logger"],
    customer,
    instance,
    user,
    connections: createConfigurationConnections(connectionNames, connections ?? configVars),
    configuration: (configuration === undefined
      ? (platform.configuration ?? {})
      : configuration) as TConfiguration,
    userConfiguration: userConfiguration ?? {},
  };
};
