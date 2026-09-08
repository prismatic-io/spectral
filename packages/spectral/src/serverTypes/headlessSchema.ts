import { toJSONSchema, type ZodType } from "zod";

import type { JsonSchema, SchemaInput } from "../types/HeadlessConfiguration";

/** Converts an author's schema to the JSON Schema that rides the wire. */

/**
 * Checks `_zod` rather than `instanceof ZodType` so a schema built by a
 * different copy of zod in the dependency tree is still recognized.
 */
export const isZodSchema = (schema: SchemaInput): schema is ZodType =>
  typeof schema === "object" &&
  schema !== null &&
  "_zod" in schema &&
  typeof (schema as { parse?: unknown }).parse === "function";

export const toJsonSchema = (schema: SchemaInput): JsonSchema => {
  if (!isZodSchema(schema)) return schema;

  const converted = toJSONSchema(schema, {
    // The consumer is a host reading shapes, not a validator resolving refs.
    io: "input",
    reused: "inline",
  }) as Record<string, unknown>;

  const { $schema: _ignored, ...rest } = converted;
  return rest as JsonSchema;
};

/** Serializes a schema for a `code`/`json` input's default. */
export const serializeSchema = (schema: SchemaInput): string =>
  JSON.stringify(toJsonSchema(schema));
