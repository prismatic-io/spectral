import type { ConfigVar } from "../types/ConfigVars";
import type {
  AnyServerFunction,
  ConfigurationConnection,
  ConfigurationInit,
  IntegrationConfiguration,
  JsonSchema,
  UiSchema,
} from "../types/IntegrationConfiguration";
import { isConnectionScopedConfigVar, type ScopedConfigVarMap } from "../types/ScopedConfigVars";
import { type ConnectionNameMap, createConfigurationContext } from "./configurationContext";
import { serializeSchema, toJsonSchema } from "./configurationSchema";

/**
 * Converts an integration `configuration` into what it publishes as: the
 * integration YAML's `configuration` block, the component's `configuration`
 * export, and the author's connections.
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

/** The component's `serverFunctions` export, which the runner calls by key. */
export type ServerComponentFunctions = Record<
  string,
  (context: unknown, inputs: unknown) => Promise<unknown>
>;

/**
 * A server function's publish metadata. Rides its own mutation variable rather
 * than the component definition, so the schemas are JSON strings here while
 * `configuration.schema` stays an object.
 */
export interface ServerFunctionDefinition {
  key: string;
  display: { label: string; description: string };
  inputSchema: string;
  outputSchema: string;
}

export interface ConvertedIntegrationConfiguration {
  configuration: IntegrationConfigurationYaml;
  /** Absent when the author wrote no `init`. */
  componentConfiguration?: ServerComponentConfiguration;
  /** The platform's only means of discovering `init`; when false, initialization no-ops. */
  hasConfigurationInit: boolean;
  /** Pointers at reusable connections, lifted to the definition's root. */
  scopedConfigVars: ScopedConfigVarMap;
  /**
   * Connections the generated component owns: inline definitions and references
   * to a published component's connection. These reach `requiredConfigVars` and
   * the component's `connections`, which is what the platform needs to collect
   * their inputs.
   */
  componentConnections: Record<string, ConfigVar>;
  connectionNames: ConnectionNameMap;
  /** Absent when the author declared none, so the export stays off the component. */
  serverFunctions?: ServerComponentFunctions;
  serverFunctionDefinitions: ServerFunctionDefinition[];
}

export const convertIntegrationConfiguration = (
  configuration: IntegrationConfiguration,
): ConvertedIntegrationConfiguration => {
  const { schema, uiSchema, eTag, init, connections = {}, serverFunctions = {} } = configuration;

  if (!schema) {
    throw new Error("configuration.schema is required.");
  }

  // The platform's import-time schema violation does not name the cause.
  if (!eTag) {
    throw new Error("configuration.eTag is required.");
  }

  const connectionEntries = Object.entries(connections as Record<string, ConfigurationConnection>);

  // A scoped connection points at something the platform already holds, so it
  // only needs a config var. The other two carry inputs the platform collects,
  // so they also need a connection on the generated component.
  const { scopedConfigVars, componentConnections } = connectionEntries.reduce<{
    scopedConfigVars: Record<string, unknown>;
    componentConnections: Record<string, ConfigVar>;
  }>(
    (acc, [name, connection]) => {
      if (isConnectionScopedConfigVar(connection as ConfigVar)) {
        acc.scopedConfigVars[name] = connection;
      } else {
        acc.componentConnections[name] = connection as ConfigVar;
      }
      return acc;
    },
    { scopedConfigVars: {}, componentConnections: {} },
  );

  // Identical to the runtime key today, but this is what tells the perform
  // wrappers which entries are connections at all.
  const connectionNames = connectionEntries.reduce<ConnectionNameMap>((acc, [name]) => {
    acc[name] = name;
    return acc;
  }, {});

  const serverFunctionEntries = Object.entries(serverFunctions);
  const convertedServerFunctions = serverFunctionEntries.reduce<ServerComponentFunctions>(
    (acc, [key, serverFunction]) => {
      acc[key] = convertServerFunction(serverFunction, connectionNames);
      return acc;
    },
    {},
  );

  return {
    configuration: {
      schema: toJsonSchema(schema),
      ...(uiSchema ? { uiSchema } : {}),
      eTag,
    },
    ...(init
      ? { componentConfiguration: { init: convertConfigurationInit(init, connectionNames) } }
      : {}),
    hasConfigurationInit: Boolean(init),
    scopedConfigVars: scopedConfigVars as ScopedConfigVarMap,
    componentConnections,
    connectionNames,
    ...(serverFunctionEntries.length ? { serverFunctions: convertedServerFunctions } : {}),
    serverFunctionDefinitions: serverFunctionEntries.map(([key, serverFunction]) =>
      convertServerFunctionDefinition(key, serverFunction),
    ),
  };
};

/** A wrapper built without an integration, as the unit tests do. */
const noConnections: ConnectionNameMap = {};

const readConfiguration = (context: unknown): unknown =>
  (context as { configuration?: unknown } | undefined)?.configuration;

const readConfigurationEtag = (context: unknown): string | null | undefined =>
  (context as { configurationEtag?: string | null } | undefined)?.configurationEtag;

const readConfigVars = (context: unknown): Record<string, unknown> =>
  (context as { configVars?: Record<string, unknown> } | undefined)?.configVars ?? {};

/**
 * Wraps `init` for the component's `configuration` export, mapping the platform
 * context onto the author's. The return passes through untouched: the platform
 * neither trims it to the schema nor saves it.
 */
export const convertConfigurationInit =
  (init: ConfigurationInit, connectionNames: ConnectionNameMap = noConnections) =>
  async (context: unknown): Promise<unknown> => {
    const authorContext = createConfigurationContext(
      context,
      connectionNames,
      readConfiguration(context),
    );

    return init(
      Object.assign(authorContext, {
        configurationEtag: readConfigurationEtag(context) ?? null,
        configVars: readConfigVars(context),
      }) as never,
    );
  };

/**
 * Wraps a `perform` for the component's `serverFunctions` export, mapping the
 * platform context onto the author's and its `inputs` onto `params`.
 *
 * The platform supplies a `configuration` on every invocation; it is withheld
 * here because a host calls this mid-configuration, when the saved value is
 * stale.
 */
export const convertServerFunction =
  (serverFunction: AnyServerFunction, connectionNames: ConnectionNameMap = noConnections) =>
  async (context: unknown, inputs: unknown): Promise<unknown> => {
    const { configuration: _withheld, ...authorContext } = createConfigurationContext(
      context,
      connectionNames,
      undefined,
    );

    return serverFunction.perform(authorContext, inputs as never);
  };

/** The platform requires both schemas and a label, so a key stands in for an absent label. */
export const convertServerFunctionDefinition = (
  key: string,
  { inputSchema, outputSchema, label, description }: AnyServerFunction,
): ServerFunctionDefinition => ({
  key,
  display: { label: label ?? key, description: description ?? "" },
  inputSchema: serializeSchema(inputSchema),
  outputSchema: serializeSchema(outputSchema),
});
