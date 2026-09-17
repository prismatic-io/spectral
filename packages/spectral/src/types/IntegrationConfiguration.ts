import type { FromSchema, JSONSchema } from "json-schema-to-ts";
import type { ZodType } from "zod";

import type { ActionLogger } from "./ActionLogger";
import type { ComponentRegistry } from "./ComponentRegistry";
import type { ConnectionConfigVar } from "./ConfigVars";
import type { CustomerAttributes } from "./CustomerAttributes";
import type { Connection } from "./Inputs";
import type { InstanceAttributes } from "./InstanceAttributes";
import type {
  CustomerActivatedConnectionConfigVar,
  OrganizationActivatedConnectionConfigVar,
} from "./ScopedConfigVars";

/** The integration configuration surface. */

export type JsonSchema = JSONSchema;

export type SchemaInput = ZodType | JsonSchema;

export type ConfigurationValue<TSchema extends SchemaInput> = TSchema extends ZodType
  ? TSchema["_zod"]["output"]
  : TSchema extends JsonSchema
    ? FromSchema<TSchema>
    : never;

/** Rendering hints, forwarded to the host verbatim. */
export type UiSchema = { readonly [key: string]: unknown };

/**
 * A connection an author may declare, keyed by the name `init` and a flow read
 * it under.
 *
 * Three kinds, which differ in what the platform has to do with them rather
 * than in how an author names them: a pointer at a reusable connection managed
 * outside the integration, an inline definition carrying its own inputs, or a
 * reference to a connection on a published component.
 *
 * User-activated connections are not here yet. The platform resolves them
 * through a user-level config page, which this surface has no equivalent for.
 */
export type ConfigurationConnection =
  | CustomerActivatedConnectionConfigVar
  | OrganizationActivatedConnectionConfigVar
  | ConnectionConfigVar;

/** What `init` and a data-source `perform` receive. */
export interface ConfigurationContext<TConfiguration = unknown> {
  logger: ActionLogger;
  customer?: CustomerAttributes;
  instance?: InstanceAttributes;
  /** Keyed by the author's names in `configuration.connections`; unresolved connections are absent. */
  connections: Record<string, Connection>;
  configuration: TConfiguration;
}

/**
 * `configuration` holds the schema's defaults with the instance's persisted
 * value over them, untyped because a stored shape may predate the schema.
 * `configurationEtag` names the shape it was written under, null before a
 * first deploy.
 */
export type ConfigurationInitContext = ConfigurationContext<DeepReadonly<unknown> | undefined> & {
  configurationEtag: string | null;
  /**
   * The values an instance configured under `configPages`, for migrating into
   * `schema`. Connections appear here under their page keys as well as in
   * `connections` under the author's.
   */
  configVars: Record<string, unknown>;
};

/**
 * Seeds the configuration on first load; migrates it after an ETag change.
 *
 * The platform neither validates nor saves the return, so it is the author's
 * own shape rather than the configuration value, and a host may run this to
 * preview a migration and discard it.
 */
export type ConfigurationInit<TResult = unknown> = (
  context: ConfigurationInitContext,
) => Promise<TResult>;

export type DeepReadonly<T> = T extends (infer TElement)[]
  ? ReadonlyArray<DeepReadonly<TElement>>
  : T extends object
    ? { readonly [TKey in keyof T]: DeepReadonly<T[TKey]> }
    : T;

/** The actions of the integration's `componentRegistry`, invocable directly. */
export type ConfiguredComponents = {
  [Key in keyof ComponentRegistry]: {
    [Action in keyof ComponentRegistry[Key]["actions"]]: ComponentRegistry[Key]["actions"][Action] extends {
      perform: infer TPerform;
    }
      ? TPerform
      : never;
  };
};

/** What a `serverFunction` perform receives, holding only the connections it declared. */
export interface ServerFunctionContext<TConnectionKey extends string = string> {
  logger: ActionLogger;
  customer?: CustomerAttributes;
  instance?: InstanceAttributes;
  /** Keyed by the names in `configuration.connections`; the caller supplies each value. */
  connections: Record<TConnectionKey, Connection>;
  /** Only the components the integration supplies reach the runner, so others are absent. */
  components: ConfiguredComponents;
}

/**
 * Runs against a deployed instance while a host configures it.
 *
 * The saved configuration is not in scope: a host calls this with values a
 * person is still editing, so it passes them through `params` instead.
 */
export type ServerFunctionPerform<
  TInputSchema extends SchemaInput,
  TConnectionKey extends string,
  TResult,
> = (
  context: ServerFunctionContext<TConnectionKey>,
  params: ConfigurationValue<TInputSchema>,
) => Promise<TResult>;

/**
 * A server function of any schemas, for collections.
 *
 * Structural rather than `ServerFunction<any, any, any>`: `params` is
 * contravariant, so a specific server function is not assignable to one over
 * `SchemaInput`, and instantiating `ConfigurationValue<any>` recurses without
 * terminating.
 */
export interface AnyServerFunction {
  inputSchema: SchemaInput;
  outputSchema: SchemaInput;
  connections?: readonly string[];
  perform: (context: never, params: never) => Promise<unknown>;
  label?: string;
  description?: string;
}

/** The connection names a `serverFunctions` record declares across all of its entries. */
export type DeclaredConnectionKeys<TServerFunctions> =
  TServerFunctions[keyof TServerFunctions] extends {
    connections?: readonly (infer TKey extends string)[];
  }
    ? TKey
    : never;

export interface ServerFunction<
  TInputSchema extends SchemaInput = SchemaInput,
  TOutputSchema extends SchemaInput = SchemaInput,
  TConnectionKey extends string = string,
  TResult = unknown,
> {
  /** Schema of `params`, which the platform validates before invoking. */
  inputSchema: TInputSchema;
  /** Published for hosts to read; the platform never validates the result against it. */
  outputSchema: TOutputSchema;
  /**
   * Names from `configuration.connections` this function needs, which the
   * caller supplies per invocation rather than the instance implying them.
   */
  connections?: readonly TConnectionKey[];
  perform: ServerFunctionPerform<TInputSchema, TConnectionKey, TResult>;
  label?: string;
  description?: string;
}

export interface IntegrationConfiguration<
  TSchema extends SchemaInput = SchemaInput,
  TInitResult = unknown,
> {
  /** Schema of the value the host saves — zod or a JSON Schema literal. */
  schema: TSchema;
  /**
   * Version marker for `schema`, compared for equality only. Required by the
   * platform: its YAML declares `eTag: str()` and the column is non-null.
   */
  eTag: string;
  /** Rendering hints, forwarded to the host verbatim. */
  uiSchema?: UiSchema;
  /** Seeds the configuration on first load; migrates it after an ETag change. */
  init?: ConfigurationInit<TInitResult>;
  /** Keyed by the name `init` and a flow read each connection under. */
  connections?: Record<string, ConfigurationConnection>;
  /** Invocable by a host against a deployed instance while configuring it. */
  serverFunctions?: Record<string, AnyServerFunction>;
}

/**
 * Augmented by an integration to type its flows:
 *
 * ```ts
 * declare module "@prismatic-io/spectral" {
 *   interface IntegrationDefinitionConfiguration extends TConfiguration {}
 * }
 * ```
 */
export interface IntegrationDefinitionConfiguration {}

/** The configuration value a flow reads, `unknown` until an integration augments. */
export type ConfiguredValue = keyof IntegrationDefinitionConfiguration extends never
  ? unknown
  : IntegrationDefinitionConfiguration extends { schema: infer TSchema extends SchemaInput }
    ? ConfigurationValue<TSchema>
    : unknown;

/** The connections a flow reads, keyed by the names the integration declared. */
export type ConfiguredConnections = keyof IntegrationDefinitionConfiguration extends never
  ? Record<string, Connection>
  : IntegrationDefinitionConfiguration extends { connections: infer TConnections }
    ? { [Key in keyof TConnections]: Connection }
    : Record<string, Connection>;
