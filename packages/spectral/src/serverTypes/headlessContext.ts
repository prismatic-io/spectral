import type { HeadlessContext } from "../types/HeadlessConfiguration";
import type { Connection } from "../types/Inputs";

/** Builds the context an author function sees. */

export interface HeadlessRuntimeShape {
  /**
   * Author's connection name -> its key in the runtime `configVars` bag.
   * Identical today, but this is what marks an entry as a connection.
   */
  connectionNames: Record<string, string>;
}

type PlatformContext = Partial<Pick<HeadlessContext, "logger" | "customer" | "instance">> & {
  configVars?: Record<string, unknown>;
};

const asPlatformContext = (context: unknown): PlatformContext =>
  context && typeof context === "object" ? (context as PlatformContext) : {};

/** Unresolved connections are absent, so `Object.keys` reports what is usable. */
export const createHeadlessConnections = (
  shape: Pick<HeadlessRuntimeShape, "connectionNames">,
  configVars: Record<string, unknown> | undefined,
): Record<string, Connection> =>
  Object.entries(shape.connectionNames).reduce<Record<string, Connection>>((acc, [name, key]) => {
    const value = configVars?.[key];
    if (value && typeof value === "object") {
      acc[name] = value as Connection;
    }
    return acc;
  }, {});

export const createHeadlessContext = <TConfiguration>(
  context: unknown,
  shape: HeadlessRuntimeShape,
  configuration: TConfiguration,
): HeadlessContext<TConfiguration> => {
  const { logger, customer, instance, configVars } = asPlatformContext(context);

  return {
    logger: logger as HeadlessContext["logger"],
    customer,
    instance,
    connections: createHeadlessConnections(shape, configVars),
    configuration,
  };
};
