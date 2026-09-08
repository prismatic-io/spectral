import type { FromSchema, JSONSchema } from "json-schema-to-ts";
import type { ZodType } from "zod";

import type { ActionLogger } from "./ActionLogger";
import type { CustomerAttributes } from "./CustomerAttributes";
import type { Connection } from "./Inputs";
import type { InstanceAttributes } from "./InstanceAttributes";
import type { ScopedConfigVarMap } from "./ScopedConfigVars";

/** The function-backed (headless) configuration surface. */

export type JsonSchema = JSONSchema;

export type SchemaInput = ZodType | JsonSchema;

export type ConfigurationValue<TSchema extends SchemaInput> = TSchema extends ZodType
  ? TSchema["_zod"]["output"]
  : TSchema extends JsonSchema
    ? FromSchema<TSchema>
    : never;

/** Rendering hints, forwarded to the host verbatim. */
export type UiSchema = { readonly [key: string]: unknown };

/** What `init` and a data-source `perform` receive. */
export interface HeadlessContext<TConfiguration = unknown> {
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
export type HeadlessInitContext = HeadlessContext<DeepReadonly<unknown> | undefined> & {
  configurationEtag: string | null;
};

/**
 * Seeds the configuration on first load; migrates it after an ETag change.
 *
 * The platform neither validates nor saves the return, so it is the author's
 * own shape rather than the configuration value, and a host may run this to
 * preview a migration and discard it.
 */
export type HeadlessInit<TResult = unknown> = (context: HeadlessInitContext) => Promise<TResult>;

export type DeepReadonly<T> = T extends (infer TElement)[]
  ? ReadonlyArray<DeepReadonly<TElement>>
  : T extends object
    ? { readonly [TKey in keyof T]: DeepReadonly<T[TKey]> }
    : T;

export interface HeadlessConfiguration<
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
  init?: HeadlessInit<TInitResult>;
  /**
   * Stable-key pointers to reusable connections managed outside this surface,
   * telling the platform which tokens to load. Not credential collection.
   */
  connections?: ScopedConfigVarMap;
}
