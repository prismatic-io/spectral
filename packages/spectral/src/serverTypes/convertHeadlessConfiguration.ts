import type { ConfigVar } from "../types/ConfigVars";
import type {
  HeadlessConfiguration,
  HeadlessConnection,
  HeadlessInit,
  JsonSchema,
  UiSchema,
} from "../types/HeadlessConfiguration";
import { isConnectionScopedConfigVar, type ScopedConfigVarMap } from "../types/ScopedConfigVars";
import { createHeadlessContext, type HeadlessRuntimeShape } from "./headlessContext";
import { toJsonSchema } from "./headlessSchema";

/**
 * Converts a function-backed `configuration` into what it publishes as: the
 * integration YAML's `configuration` block, the component's `configuration`
 * export, and the author's connections.
 */

/**
 * `schema` and `uiSchema` are objects, not JSON strings: the platform declares
 * them `map(any(), key=str())`, so a serialized one fails at import.
 */
export interface HeadlessConfigurationYaml {
  schema: JsonSchema;
  uiSchema: UiSchema;
  eTag: string;
}

/** The component's `configuration` export. */
export interface ServerComponentConfiguration {
  init: (context: unknown) => Promise<unknown>;
}

export interface ConvertedHeadlessConfiguration {
  configuration: HeadlessConfigurationYaml;
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
  runtimeShape: HeadlessRuntimeShape;
}

/** JSON Forms renders nothing without a uiSchema, so an absent one gets a bare layout. */
export const DEFAULT_UI_SCHEMA: UiSchema = { type: "VerticalLayout", elements: [] };

export const convertHeadlessConfiguration = (
  configuration: HeadlessConfiguration,
): ConvertedHeadlessConfiguration => {
  const { schema, uiSchema, eTag, init, connections = {} } = configuration;

  if (!schema) {
    throw new Error("configuration.schema is required.");
  }

  // The platform's import-time schema violation does not name the cause.
  if (!eTag) {
    throw new Error("configuration.eTag is required.");
  }

  const connectionEntries = Object.entries(connections as Record<string, HeadlessConnection>);

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
  const connectionNames = connectionEntries.reduce<Record<string, string>>((acc, [name]) => {
    acc[name] = name;
    return acc;
  }, {});

  const runtimeShape: HeadlessRuntimeShape = { connectionNames };

  return {
    configuration: {
      schema: toJsonSchema(schema),
      uiSchema: uiSchema ?? DEFAULT_UI_SCHEMA,
      eTag,
    },
    ...(init ? { componentConfiguration: { init: convertHeadlessInit(init, runtimeShape) } } : {}),
    hasConfigurationInit: Boolean(init),
    scopedConfigVars: scopedConfigVars as ScopedConfigVarMap,
    componentConnections,
    runtimeShape,
  };
};

/** A wrapper built without an integration, as the unit tests do. */
const defaultShape: HeadlessRuntimeShape = { connectionNames: {} };

const readConfiguration = (context: unknown): unknown =>
  (context as { configuration?: unknown } | undefined)?.configuration;

const readConfigurationEtag = (context: unknown): string | null | undefined =>
  (context as { configurationEtag?: string | null } | undefined)?.configurationEtag;

/**
 * Wraps `init` for the component's `configuration` export, mapping the platform
 * context onto the author's. The return passes through untouched: the platform
 * neither trims it to the schema nor saves it.
 */
export const convertHeadlessInit =
  (init: HeadlessInit, shape: HeadlessRuntimeShape = defaultShape) =>
  async (context: unknown): Promise<unknown> => {
    const authorContext = createHeadlessContext(context, shape, readConfiguration(context));

    return init(
      Object.assign(authorContext, {
        configurationEtag: readConfigurationEtag(context) ?? null,
      }) as never,
    );
  };
