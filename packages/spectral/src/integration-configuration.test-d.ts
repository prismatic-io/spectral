import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import {
  type ConfiguredConnections,
  type ConfiguredUserValue,
  type Connection,
  configuration,
  type IntegrationConfigurationContext,
  type UserAttributes,
} from ".";

/**
 * A broken version arm can degrade to `unknown` rather than erroring, and the whole surface
 * sits close enough to TypeScript's instantiation budget that a structural
 * change can silently stop narrowing. These assert the narrowing directly.
 */

const currentSchema = z.object({
  objectName: z.string(),
  mappings: z.array(z.object({ source: z.string(), destination: z.string() })),
});

const v1Schema = z.object({ objectKey: z.string() });

// First setup can arrive as {}, so legacy fields become optional on the null arm.
const configPagesSchema = z.object({
  objectKey: z.string().optional(),
  region: z.string().optional(),
});

// No `: string` annotation: the literal type is what makes the current arm work.
const CURRENT_VERSION = "config-v2";

type Mappings = readonly { readonly source: string; readonly destination: string }[];

describe("configuration version narrowing", () => {
  it("narrows to the schema a version was written under", () => {
    configuration({
      instance: {
        schema: currentSchema,
        version: CURRENT_VERSION,
        versionSchemas: { "config-v1": v1Schema },
        configPagesSchema,
      },
      init: {
        perform: async (context) => {
          if (context.configurationVersion === "config-v1") {
            expectTypeOf(context.configuration).toEqualTypeOf<{ readonly objectKey: string }>();
            return {};
          }

          if (context.configurationVersion === CURRENT_VERSION) {
            expectTypeOf(context.configuration).toEqualTypeOf<{
              readonly objectName: string;
              readonly mappings: Mappings;
            }>();
            return {};
          }

          return {};
        },
      },
    });
  });

  it("narrows a null version to the configPages shape", () => {
    configuration({
      instance: {
        schema: currentSchema,
        version: CURRENT_VERSION,
        configPagesSchema,
      },
      init: {
        perform: async (context) => {
          if (context.configurationVersion === null) {
            expectTypeOf(context.configuration).toEqualTypeOf<{
              readonly objectKey?: string;
              readonly region?: string;
            }>();
          }
          return {};
        },
      },
    });
  });

  it("leaves an undeclared version unknown", () => {
    configuration({
      instance: {
        schema: currentSchema,
        version: CURRENT_VERSION,
        versionSchemas: { "config-v1": v1Schema },
      },
      init: {
        perform: async (context) => {
          if (
            context.configurationVersion !== null &&
            context.configurationVersion !== "config-v1" &&
            context.configurationVersion !== CURRENT_VERSION
          ) {
            expectTypeOf(context.configuration).toEqualTypeOf<unknown>();
          }
          return {};
        },
      },
    });
  });

  it("keeps the live schema when an author leaves the current version in the map", () => {
    // `Omit` first, so the current `version` resolves to `schema` rather than
    // pairing the two into a value that satisfies both at once.
    configuration({
      instance: {
        schema: currentSchema,
        version: CURRENT_VERSION,
        versionSchemas: { [CURRENT_VERSION]: v1Schema },
      },
      init: {
        perform: async (context) => {
          if (context.configurationVersion === CURRENT_VERSION) {
            expectTypeOf(context.configuration).toEqualTypeOf<{
              readonly objectName: string;
              readonly mappings: Mappings;
            }>();
          }
          return {};
        },
      },
    });
  });

  it("reports the stored value as deeply readonly", () => {
    configuration({
      instance: {
        schema: currentSchema,
        version: CURRENT_VERSION,
      },
      init: {
        perform: async (context) => {
          if (context.configurationVersion === CURRENT_VERSION) {
            expectTypeOf(context.configuration.mappings).toEqualTypeOf<Mappings>();
          }
          return {};
        },
      },
    });
  });

  it("still infers the schema and the init result alongside the map", () => {
    const definition = configuration({
      instance: {
        schema: currentSchema,
        version: CURRENT_VERSION,
        versionSchemas: { "config-v1": v1Schema },
      },
      init: { perform: async () => ({ migrated: true }) },
    });

    expectTypeOf(definition.instance.schema).toEqualTypeOf<typeof currentSchema>();
    expectTypeOf(definition.instance.version).toEqualTypeOf<typeof CURRENT_VERSION>();

    type InitResult = Awaited<ReturnType<NonNullable<typeof definition.init>["perform"]>>;
    expectTypeOf<InitResult>().toEqualTypeOf<{ migrated: boolean }>();
  });

  it("narrows only instance values even when user versions have identical names", () => {
    const userSchema = z.object({ locale: z.string() });
    const previousUserSchema = z.object({ language: z.string() });

    configuration({
      instance: {
        schema: currentSchema,
        version: CURRENT_VERSION,
        versionSchemas: { "config-v1": v1Schema },
      },
      userLevel: {
        schema: userSchema,
        version: CURRENT_VERSION,
        versionSchemas: { "config-v1": previousUserSchema },
      },
      init: {
        perform: async (context) => {
          // @ts-expect-error init has no scope discriminator
          context.scope;
          expectTypeOf(context.user).toEqualTypeOf<UserAttributes | undefined>();
          if (context.configurationVersion === "config-v1") {
            expectTypeOf(context.userConfiguration).toEqualTypeOf<unknown>();
            expectTypeOf(context.configuration).toEqualTypeOf<{
              readonly objectKey: string;
            }>();
          }
          if (context.configurationVersion === CURRENT_VERSION) {
            expectTypeOf(context.userConfiguration).toEqualTypeOf<unknown>();
            expectTypeOf(context.configuration).toEqualTypeOf<{
              readonly objectName: string;
              readonly mappings: Mappings;
            }>();
          }
          return {};
        },
      },
    });
  });

  it("keeps saved user data unknown for null and undeclared instance versions", () => {
    configuration({
      instance: { schema: currentSchema, version: CURRENT_VERSION },
      userLevel: {
        schema: z.object({ locale: z.string() }),
        version: "user-v2",
        versionSchemas: { "user-v1": z.object({ language: z.string() }) },
        configPagesSchema: z.object({ locale: z.string() }),
      },
      init: {
        perform: async (context) => {
          if (context.configurationVersion === null) {
            expectTypeOf(context.configuration).toEqualTypeOf<unknown>();
            expectTypeOf(context.userConfiguration).toEqualTypeOf<unknown>();
          }
          if (
            context.configurationVersion !== null &&
            context.configurationVersion !== CURRENT_VERSION
          ) {
            expectTypeOf(context.configuration).toEqualTypeOf<unknown>();
            expectTypeOf(context.userConfiguration).toEqualTypeOf<unknown>();
          }
          return {};
        },
      },
    });
  });

  it("infers user JSON Schema histories in the returned definition", () => {
    const userSchema = {
      type: "object",
      properties: { locale: { type: "string" } },
      required: ["locale"],
      additionalProperties: false,
    } as const;
    const definition = configuration({
      instance: { schema: currentSchema, version: CURRENT_VERSION },
      userLevel: {
        schema: userSchema,
        version: "user-v2",
        versionSchemas: {
          "user-v1": {
            type: "object",
            properties: { language: { type: "string" } },
            required: ["language"],
            additionalProperties: false,
          },
        },
      },
    });

    expectTypeOf(definition.userLevel.schema).toEqualTypeOf<typeof userSchema>();
    expectTypeOf(definition.userLevel.version).toEqualTypeOf<"user-v2">();
    expectTypeOf(definition.userLevel.versionSchemas["user-v1"]).toEqualTypeOf<{
      readonly type: "object";
      readonly properties: { readonly language: { readonly type: "string" } };
      readonly required: readonly ["language"];
      readonly additionalProperties: false;
    }>();
  });

  it("keeps open connection and unknown user-value types without module augmentation", () => {
    expectTypeOf<ConfiguredUserValue>().toEqualTypeOf<unknown>();
    expectTypeOf<IntegrationConfigurationContext["userConfiguration"]>().toEqualTypeOf<unknown>();
    expectTypeOf<ConfiguredConnections>().toEqualTypeOf<{
      instance: Record<string, Connection>;
      userLevel: Record<string, Connection>;
    }>();
  });
});
