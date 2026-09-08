import type {
  IntegrationConfiguration,
  ConfigurationInit,
  JsonSchema,
  UiSchema,
} from "../types/IntegrationConfiguration";
import type { ScopedConfigVarMap } from "../types/ScopedConfigVars";
import { createConfigurationContext, type ConnectionNameMap } from "./configurationContext";
import { toJsonSchema } from "./configurationSchema";

/**
 * Converts a function-backed `configuration` into what it publishes as: the
 * integration YAML's `configuration` block, the component's `configuration`
 * export, and scoped config vars for the author's connections.
 */

/**
 * `schema` and `uiSchema` are objects, not JSON strings: the platform declares
 * them `map(any(), key=str())`, so a serialized one fails at import.
 */
export interface IntegrationConfigurationYaml {
  schema: JsonSchema;
  /** Omitted when the author wrote none, which the platform stores as null. */
  uiSchema?: UiSchema;
  eTag: string;
}

/** The component's `configuration` export. */
export interface ServerComponentConfiguration {
  init: (context: unknown) => Promise<unknown>;
}

export interface ConvertedIntegrationConfiguration {
  configuration: IntegrationConfigurationYaml;
  /** Absent when the author wrote no `init`. */
  componentConfiguration?: ServerComponentConfiguration;
  /** The platform's only means of discovering `init`; when false, initialization no-ops. */
  hasConfigurationInit: boolean;
  scopedConfigVars: ScopedConfigVarMap;
  connectionNames: ConnectionNameMap;
}

export const convertIntegrationConfiguration = (
  configuration: IntegrationConfiguration,
): ConvertedIntegrationConfiguration => {
  const { schema, uiSchema, eTag, init, connections = {} } = configuration;

  if (!schema) {
    throw new Error("configuration.schema is required.");
  }

  // The platform's import-time schema violation does not name the cause.
  if (!eTag) {
    throw new Error("configuration.eTag is required.");
  }

  const connectionEntries = Object.entries(connections as Record<string, { stableKey: string }>);

  const scopedConfigVars = connectionEntries.reduce<Record<string, unknown>>(
    (acc, [name, connection]) => {
      acc[name] = connection;
      return acc;
    },
    {},
  );

  // Identical to the runtime key today, but this is what tells the perform
  // wrappers which entries are connections at all.
  const connectionNames = connectionEntries.reduce<ConnectionNameMap>((acc, [name]) => {
    acc[name] = name;
    return acc;
  }, {});

  return {
    configuration: {
      schema: toJsonSchema(schema),
      ...(uiSchema ? { uiSchema } : {}),
      eTag,
    },
    ...(init ? { componentConfiguration: { init: convertConfigurationInit(init, connectionNames) } } : {}),
    hasConfigurationInit: Boolean(init),
    scopedConfigVars: scopedConfigVars as ScopedConfigVarMap,
    connectionNames,
  };
};

/** A wrapper built without an integration, as the unit tests do. */
const noConnections: ConnectionNameMap = {};

const readConfiguration = (context: unknown): unknown =>
  (context as { configuration?: unknown } | undefined)?.configuration;

const readConfigurationEtag = (context: unknown): string | null | undefined =>
  (context as { configurationEtag?: string | null } | undefined)?.configurationEtag;

/**
 * Wraps `init` for the component's `configuration` export, mapping the platform
 * context onto the author's. The return passes through untouched: the platform
 * neither trims it to the schema nor saves it.
 */
export const convertConfigurationInit =
  (init: ConfigurationInit, connectionNames: ConnectionNameMap = noConnections) =>
  async (context: unknown): Promise<unknown> => {
    const authorContext = createConfigurationContext(context, connectionNames, readConfiguration(context));

    return init(
      Object.assign(authorContext, {
        configurationEtag: readConfigurationEtag(context) ?? null,
      }) as never,
    );
  };
