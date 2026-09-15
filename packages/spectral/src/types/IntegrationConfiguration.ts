import type { FromSchema, JSONSchema } from "json-schema-to-ts";
import type { ZodType } from "zod";

import type { ActionLogger } from "./ActionLogger";
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
