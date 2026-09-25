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

// Resolved behind interface properties, which TypeScript caches per type
// argument; written as bare conditionals these re-walk zod's output inference at
// every use site.
interface ZodOutputOf<TSchema extends ZodType> {
  value: TSchema["_zod"]["output"];
}

interface JsonSchemaValueOf<TSchema extends JsonSchema> {
  value: FromSchema<TSchema>;
}

interface ConfigurationValueOf<TSchema extends SchemaInput> {
  value: TSchema extends ZodType
    ? ZodOutputOf<TSchema>["value"]
    : TSchema extends JsonSchema
      ? JsonSchemaValueOf<TSchema>["value"]
      : never;
}

export type ConfigurationValue<TSchema extends SchemaInput> =
  ConfigurationValueOf<TSchema>["value"];

/** A schema's value as `init` reads it. */
interface StoredConfigurationValueOf<TSchema extends SchemaInput> {
  value: DeepReadonly<ConfigurationValueOf<TSchema>["value"]>;
}

export type StoredConfigurationValue<TSchema extends SchemaInput> =
  StoredConfigurationValueOf<TSchema>["value"];

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
 * The etag of a value written under a shape the author never declared. Branded
 * rather than `string`, which would overlap every declared etag and leave
 * `configuration` unnarrowed in all of them.
 */
declare const unrecognizedEtag: unique symbol;
export type UnrecognizedEtag = typeof unrecognizedEtag;

/** The schemas an author declares for shapes a stored value may still be in. */
export type ETagSchemas = Record<string, SchemaInput>;

/**
 * The key `configPagesSchema` rides under inside the etag map, since `null`
 * cannot key one. `ETagArms` maps it back to a `null` discriminant, so it never
 * reaches an author.
 */
type ConfigPagesKey = "__prismatic_config_pages__";

/**
 * Every shape a stored value may be in, keyed by the etag it was written under,
 * with `schema` under the current `eTag` and `configPagesSchema` under
 * `ConfigPagesKey`. `Omit` first, so an etag appearing in both `eTagSchemas` and
 * `eTag` resolves to `schema` rather than to both shapes at once.
 */
export type ETagSchemaMap<
  TSchema extends SchemaInput,
  TETag extends string,
  TETagsSchema extends ETagSchemas,
  TConfigPagesSchema extends SchemaInput,
> = ETagSchemaMapOf<TSchema, TETag, TETagsSchema, TConfigPagesSchema>["map"];

interface ETagSchemaMapOf<
  TSchema extends SchemaInput,
  TETag extends string,
  TETagsSchema extends ETagSchemas,
  TConfigPagesSchema extends SchemaInput,
> {
  map: Omit<TETagsSchema, TETag | ConfigPagesKey> & { [Key in TETag]: TSchema } & {
    [Key in ConfigPagesKey]: TConfigPagesSchema;
  };
}

/** The fields every `init` context arm shares. */
export interface ConfigurationInitContextBase {
  logger: ActionLogger;
  customer?: CustomerAttributes;
  instance?: InstanceAttributes;
  /** Keyed by the author's names in `configuration.connections`; unresolved connections are absent. */
  connections: Record<string, Connection>;
  /**
   * The values an instance configured under `configPages`, keyed by page key,
   * and also folded onto `configuration` before a first deploy. Connections
   * appear here as well as in `connections` under the author's names.
   */
  configVars: Record<string, unknown>;
}

/**
 * One arm per key in the finished map, with the `configPages` key reported as
 * the `null` etag and its value widened by `undefined`, since an instance that
 * was never configured reaches `init` under that same etag with nothing to read.
 */
export type ETagArms<TMap extends ETagSchemas> = {
  [Key in keyof TMap & string]: Key extends ConfigPagesKey
    ? { configurationEtag: null; configuration: StoredConfigurationValue<TMap[Key]> | undefined }
    : { configurationEtag: Key; configuration: StoredConfigurationValue<TMap[Key]> };
}[keyof TMap & string];

/**
 * What `init` receives. Testing `configurationEtag` narrows `configuration` to
 * the schema that etag was written under:
 *
 * - `null`, before a first deploy: the `configPagesSchema` shape, or `undefined`
 *   when there was nothing to migrate.
 * - a declared etag: its schema in `eTagSchemas`.
 * - the current `eTag`: `schema`.
 * - an etag nobody declared: `unknown`.
 */
export type ConfigurationInitContext<
  TSchema extends SchemaInput = SchemaInput,
  TETag extends string = string,
  TETagsSchema extends ETagSchemas = ETagSchemas,
  TConfigPagesSchema extends SchemaInput = never,
> = ConfigurationInitContextBase &
  (
    | ETagArms<ETagSchemaMap<TSchema, TETag, TETagsSchema, TConfigPagesSchema>>
    | { configurationEtag: UnrecognizedEtag; configuration: unknown }
  );

/**
 * Seeds the configuration on first load; migrates it after an ETag change.
 *
 * The platform neither validates nor saves the return, so it is the author's
 * own shape rather than the configuration value, and a host may run this to
 * preview a migration and discard it.
 */
export type ConfigurationInit<
  TResult = unknown,
  TSchema extends SchemaInput = SchemaInput,
  TETag extends string = string,
  TETagsSchema extends ETagSchemas = ETagSchemas,
  TConfigPagesSchema extends SchemaInput = never,
> = (
  context: ConfigurationInitContext<TSchema, TETag, TETagsSchema, TConfigPagesSchema>,
) => Promise<TResult>;

/**
 * An `init` of any schemas, for the conversion layer, which only moves the
 * context through. Instantiating `ConfigurationInit` at its defaults instead
 * would map `ConfigurationValue` over every schema `SchemaInput` admits.
 */
export type AnyConfigurationInit = (
  context: ConfigurationInitContextBase & {
    configurationEtag: string | null;
    configuration: unknown;
  },
) => Promise<unknown>;

/** An integration configuration of any schemas, for the conversion layer. */
export interface AnyIntegrationConfiguration
  extends Omit<IntegrationConfiguration, "init" | "eTagSchemas" | "configPagesSchema"> {
  init?: AnyConfigurationInit;
}

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
  TETag extends string = string,
  TETagsSchema extends ETagSchemas = ETagSchemas,
  TConfigPagesSchema extends SchemaInput = never,
> {
  /** Schema of the value the host saves — zod or a JSON Schema literal. */
  schema: TSchema;
  /**
   * Version marker for `schema`, compared for equality only. Required by the
   * platform: its YAML declares `eTag: str()` and the column is non-null.
   */
  eTag: TETag;
  /**
   * Schemas a stored value may still be in, keyed by the etag it was written
   * under, so `init` can narrow by testing `configurationEtag`. Never published,
   * and the current `eTag` need not appear — `schema` covers it.
   */
  eTagSchemas?: TETagsSchema;
  /**
   * The shape of an instance's `configPages` values, for an integration moving
   * off a headed configuration. Narrows `configuration` on the `null` etag arm,
   * where those values are folded in. Never published.
   */
  configPagesSchema?: TConfigPagesSchema;
  /** Rendering hints, forwarded to the host verbatim. */
  uiSchema?: UiSchema;
  /** Seeds the configuration on first load; migrates it after an ETag change. */
  init?: ConfigurationInit<TInitResult, TSchema, TETag, TETagsSchema, TConfigPagesSchema>;
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
