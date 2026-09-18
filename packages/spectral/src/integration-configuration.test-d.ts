import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { configuration } from ".";

/**
 * The etag map is type-level only, and every way it can fail still compiles: a
 * broken arm degrades to `unknown` rather than erroring, and the whole surface
 * sits close enough to TypeScript's instantiation budget that a structural
 * change can silently stop narrowing. These assert the narrowing directly.
 */

const currentSchema = z.object({
  objectName: z.string(),
  mappings: z.array(z.object({ source: z.string(), destination: z.string() })),
});

const v1Schema = z.object({ objectKey: z.string() });

// Plain, not `.optional()`: the SDK adds `| undefined` to the null arm itself.
const configPagesSchema = z.object({
  objectKey: z.string().optional(),
  region: z.string().optional(),
});

// No `: string` annotation: the literal type is what makes the current arm work.
const CURRENT_E_TAG = "config-v2";

type Mappings = readonly { readonly source: string; readonly destination: string }[];

describe("etag narrowing", () => {
  it("narrows to the schema an etag was written under", () => {
    configuration({
      schema: currentSchema,
      eTag: CURRENT_E_TAG,
      eTagSchemas: { "config-v1": v1Schema },
      configPagesSchema,
      init: async (context) => {
        if (context.configurationEtag === "config-v1") {
          expectTypeOf(context.configuration).toEqualTypeOf<{ readonly objectKey: string }>();
          return {};
        }

        if (context.configurationEtag === CURRENT_E_TAG) {
          expectTypeOf(context.configuration).toEqualTypeOf<{
            readonly objectName: string;
            readonly mappings: Mappings;
          }>();
          return {};
        }

        return {};
      },
    });
  });

  it("narrows a null etag to the configPages shape", () => {
    configuration({
      schema: currentSchema,
      eTag: CURRENT_E_TAG,
      configPagesSchema,
      init: async (context) => {
        if (context.configurationEtag === null) {
          expectTypeOf(context.configuration).toEqualTypeOf<
            { readonly objectKey?: string; readonly region?: string } | undefined
          >();
        }
        return {};
      },
    });
  });

  it("leaves an undeclared etag unknown", () => {
    configuration({
      schema: currentSchema,
      eTag: CURRENT_E_TAG,
      eTagSchemas: { "config-v1": v1Schema },
      init: async (context) => {
        if (
          context.configurationEtag !== null &&
          context.configurationEtag !== "config-v1" &&
          context.configurationEtag !== CURRENT_E_TAG
        ) {
          expectTypeOf(context.configuration).toEqualTypeOf<unknown>();
        }
        return {};
      },
    });
  });

  it("keeps the live schema when an author leaves the current etag in the map", () => {
    // `Omit` first, so the current `eTag` resolves to `schema` rather than
    // pairing the two into a value that satisfies both at once.
    configuration({
      schema: currentSchema,
      eTag: CURRENT_E_TAG,
      eTagSchemas: { [CURRENT_E_TAG]: v1Schema },
      init: async (context) => {
        if (context.configurationEtag === CURRENT_E_TAG) {
          expectTypeOf(context.configuration).toEqualTypeOf<{
            readonly objectName: string;
            readonly mappings: Mappings;
          }>();
        }
        return {};
      },
    });
  });

  it("reports the stored value as deeply readonly", () => {
    configuration({
      schema: currentSchema,
      eTag: CURRENT_E_TAG,
      init: async (context) => {
        if (context.configurationEtag === CURRENT_E_TAG) {
          expectTypeOf(context.configuration.mappings).toEqualTypeOf<Mappings>();
        }
        return {};
      },
    });
  });

  it("still infers the schema and the init result alongside the map", () => {
    const definition = configuration({
      schema: currentSchema,
      eTag: CURRENT_E_TAG,
      eTagSchemas: { "config-v1": v1Schema },
      init: async () => ({ migrated: true }),
    });

    expectTypeOf(definition.schema).toEqualTypeOf<typeof currentSchema>();
    expectTypeOf(definition.eTag).toEqualTypeOf<typeof CURRENT_E_TAG>();

    type InitResult = Awaited<ReturnType<NonNullable<typeof definition.init>>>;
    expectTypeOf<InitResult>().toEqualTypeOf<{ migrated: boolean }>();
  });
});
