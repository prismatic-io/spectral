import type { ComponentRegistry } from "../types/ComponentRegistry";
import {
  type ConfigVar,
  isConnectionDefinitionConfigVar,
  isConnectionReferenceConfigVar,
} from "../types/ConfigVars";
import type {
  AnyConfigurationInit,
  AnyIntegrationConfiguration,
  AnyServerFunction,
  ConfigurationScope,
  JsonSchema,
  UiSchema,
} from "../types/IntegrationConfiguration";
import {
  isConnectionScopedConfigVar,
  isOrgOrCustomerActivatedConnection,
  isUserScopedConnectionConfigVar,
  type ScopedConfigVarMap,
} from "../types/ScopedConfigVars";
import { type ConnectionNameMap, createConfigurationContext } from "./configurationContext";
import { serializeSchema, toJsonSchema } from "./configurationSchema";
import { createComponentMethods } from "./context";

/**
 * Converts an integration `configuration` into what it publishes as: the
 * integration YAML's `configuration` block, the component's `configuration`
 * export, and the author's connections.
 */

/**
 * `schema` and `uiSchema` are objects, not JSON strings: the platform declares
 * them `map(any(), key=str())`, so a serialized one fails at import.
 */
export interface ConfigurationDescriptorYaml {
  schema: JsonSchema;
  /** Omitted when the author wrote none, which the platform stores as null. */
  uiSchema?: UiSchema;
  version: string;
  versionSchemas?: Record<string, JsonSchema>;
}

export interface IntegrationConfigurationYaml {
  instance: ConfigurationDescriptorYaml;
  userLevel?: ConfigurationDescriptorYaml;
}

/** The component's `configuration` export. */
export interface ServerComponentConfiguration {
  init: { perform: (context: unknown) => Promise<unknown>; connections?: string[] };
}

/** The component's `serverFunctions` export, which the runner calls by key. */
export type ServerComponentFunctions = Record<
  string,
  (context: unknown, inputs: unknown) => Promise<unknown>
>;

/**
 * A server function's publish metadata. Rides its own mutation variable rather
 * than the component definition, so the schemas are JSON strings here while
 * `configuration.instance.schema` stays an object.
 */
export interface ServerFunctionDefinition {
  key: string;
  display: { label: string; description: string };
  inputSchema: string;
  outputSchema: string;
  /** Required config-var keys, including managed connections the platform supplies. */
  connections?: string[];
}

export interface ConvertedIntegrationConfiguration {
  configuration: IntegrationConfigurationYaml;
  /** Absent when the author wrote no `init`. */
  componentConfiguration?: ServerComponentConfiguration;
  /** Init publish metadata; absence means the integration has no initializer. */
  configurationInit?: { connections?: string[] };
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
  userLevelConnectionNames: string[];
  /** Absent when the author declared none, so the export stays off the component. */
  serverFunctions?: ServerComponentFunctions;
  serverFunctionDefinitions: ServerFunctionDefinition[];
}

export const convertIntegrationConfiguration = (
  configuration: AnyIntegrationConfiguration,
  componentRegistry: ComponentRegistry = {},
): ConvertedIntegrationConfiguration => {
  const { instance, userLevel, init, serverFunctions = {} } = configuration;
  const descriptor = (
    scope: ConfigurationScope<unknown> | undefined,
    name: string,
  ): ConfigurationDescriptorYaml => {
    if (!scope || scope.schema === undefined)
      throw new Error(`configuration.${name}.schema is required.`);
    if (!scope.version) throw new Error(`configuration.${name}.version is required.`);
    return {
      schema: toJsonSchema(scope.schema),
      version: scope.version,
      ...(scope.uiSchema ? { uiSchema: scope.uiSchema } : {}),
      ...(scope.versionSchemas
        ? {
            versionSchemas: Object.fromEntries(
              Object.entries(scope.versionSchemas)
                .filter(([version]) => version !== scope.version)
                .map(([version, schema]) => [version, toJsonSchema(schema)]),
            ),
          }
        : {}),
    };
  };
  const instanceDescriptor = descriptor(instance, "instance");
  const userDescriptor = userLevel ? descriptor(userLevel, "userLevel") : undefined;
  const connectionEntries = [
    ...Object.entries(instance.connections ?? {}).map(([key, value]) => {
      if (isUserScopedConnectionConfigVar(value))
        throw new Error(`Instance connection "${key}" cannot be user activated.`);
      return [`instance.${key}`, value] as const;
    }),
    ...Object.entries(userLevel?.connections ?? {}).map(([key, value]) => {
      if (isOrgOrCustomerActivatedConnection(value))
        throw new Error(
          `User-level connection "${key}" must be user activated or integration-defined.`,
        );
      return [`userLevel.${key}`, value] as const;
    }),
  ];

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
      } else if (
        isConnectionDefinitionConfigVar(connection as ConfigVar) ||
        isConnectionReferenceConfigVar(connection as ConfigVar)
      ) {
        acc.componentConnections[name] = connection as ConfigVar;
      } else {
        throw new Error(`Invalid configuration connection: "${name}"`);
      }
      return acc;
    },
    { scopedConfigVars: Object.create(null), componentConnections: Object.create(null) },
  );

  // Identical to the runtime key today, but this is what tells the perform
  // wrappers which entries are connections at all.
  const connectionNames = connectionEntries.reduce<ConnectionNameMap>((acc, [name]) => {
    if (!name.slice(name.indexOf(".") + 1)) {
      throw new Error(`Configuration connection name must not be empty: "${name}"`);
    }
    acc[name] = name;
    return acc;
  }, Object.create(null));

  const serverFunctionEntries = Object.entries(serverFunctions);
  const convertedServerFunctions = serverFunctionEntries.reduce<ServerComponentFunctions>(
    (acc, [key, serverFunction]) => {
      acc[key] = convertServerFunction(serverFunction, connectionNames, componentRegistry);
      return acc;
    },
    Object.create(null),
  );

  return {
    configuration: {
      instance: instanceDescriptor,
      ...(userDescriptor ? { userLevel: userDescriptor } : {}),
    },
    ...(init
      ? {
          componentConfiguration: {
            init: {
              perform: convertConfigurationInit(
                init.perform,
                selectConnections(init.connections, connectionNames),
              ),
              ...(init.connections?.length ? { connections: [...init.connections] } : {}),
            },
          },
          configurationInit: init.connections?.length ? { connections: [...init.connections] } : {},
        }
      : {}),
    scopedConfigVars: scopedConfigVars as ScopedConfigVarMap,
    componentConnections,
    connectionNames,
    userLevelConnectionNames: connectionEntries
      .map(([name]) => name)
      .filter((name) => name.startsWith("userLevel.")),
    ...(serverFunctionEntries.length ? { serverFunctions: convertedServerFunctions } : {}),
    serverFunctionDefinitions: serverFunctionEntries.map(([key, serverFunction]) =>
      convertServerFunctionDefinition(key, serverFunction),
    ),
  };
};

/** A wrapper built without an integration, as the unit tests do. */
const noConnections: ConnectionNameMap = {};

export const selectConnections = (
  dependencies: readonly string[] | undefined,
  available: ConnectionNameMap,
): ConnectionNameMap =>
  Object.fromEntries(
    (dependencies ?? []).map((key) => {
      if (!Object.hasOwn(available, key))
        throw new Error(`Undeclared configuration connection: "${key}"`);
      return [key, available[key]];
    }),
  );

const readConfigurationVersion = (context: unknown): string | null | undefined =>
  (context as { configurationVersion?: string | null } | undefined)?.configurationVersion;

const readConfigVars = (context: unknown): Record<string, unknown> =>
  (context as { configVars?: Record<string, unknown> } | undefined)?.configVars ?? {};

/**
 * Wraps `init` for the component's `configuration` export, mapping the platform
 * context onto the author's. The return passes through untouched: the platform
 * neither trims it to the schema nor saves it.
 */
export const convertConfigurationInit =
  (init: AnyConfigurationInit, connectionNames: ConnectionNameMap = noConnections) =>
  async (context: unknown): Promise<unknown> => {
    const configurationVersion = readConfigurationVersion(context) ?? null;
    const configVars = readConfigVars(context);
    const authorContext = createConfigurationContext(context, connectionNames);
    return init(Object.assign(authorContext, { configurationVersion, configVars }) as never);
  };

/**
 * Wraps a `perform` for the component's `serverFunctions` export, mapping the
 * platform context onto the author's and its `inputs` onto `params`.
 *
 * Saved values remain on context; unsaved form values arrive independently as inputs.
 */
export const convertServerFunction = (
  serverFunction: AnyServerFunction,
  connectionNames: ConnectionNameMap = noConnections,
  componentRegistry: ComponentRegistry = {},
) => {
  const dependencies = selectConnections(serverFunction.connections, connectionNames);
  return async (context: unknown, inputs: unknown): Promise<unknown> => {
    const authorContext = createConfigurationContext(context, dependencies);

    return serverFunction.perform(
      Object.assign(authorContext, {
        components: createComponentMethods(context as never, componentRegistry),
      }) as never,
      inputs as never,
    );
  };
};

/** The platform requires both schemas and a label, so a key stands in for an absent label. */
export const convertServerFunctionDefinition = (
  key: string,
  { inputSchema, outputSchema, connections, label, description }: AnyServerFunction,
): ServerFunctionDefinition => ({
  key,
  display: { label: label ?? key, description: description ?? "" },
  inputSchema: serializeSchema(inputSchema),
  outputSchema: serializeSchema(outputSchema),
  ...(connections?.length ? { connections: [...connections] } : {}),
});
