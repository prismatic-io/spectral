import { describe, expect, it } from "vitest";

import {
  CONFIGURATION_E_TAG,
  CUSTOMER_CONNECTION_STABLE_KEY,
  configurationUiSchema,
  headlessConfigurationDefinition,
  headlessConfigurationIntegration,
  noInitIntegration,
  ORG_CONNECTION_STABLE_KEY,
  PREVIOUS_CONFIGURATION_E_TAG,
} from "./headless-configuration.fixture";
import { convertHeadlessInit } from "./serverTypes/convertHeadlessConfiguration";
import type { HeadlessRuntimeShape } from "./serverTypes/headlessContext";
import { toJsonSchema } from "./serverTypes/headlessSchema";

/**
 * Drift guards for headless configuration. The negative tests carry the weight:
 * a positive test says "this works", a negative one says "this must not become
 * possible."
 */

/** `integration()` already converted the fixture; this is the emitted component. */
const convert = () => headlessConfigurationIntegration;

const dataSourceKeys = () => Object.keys(convert().dataSources ?? {});

const yaml = () => {
  const { codeNativeIntegrationYAML } = convert() as unknown as {
    codeNativeIntegrationYAML: string;
  };
  return codeNativeIntegrationYAML;
};

/** The component's `configuration` export, which carries `init`. */
const emittedConfiguration = () =>
  (convert() as unknown as { configuration?: { init?: (context: unknown) => Promise<unknown> } })
    .configuration;

/** A resolved connection as the runtime hands it to a flow or data source. */
const connectionValue = (configVarKey: string) => ({
  key: "slack",
  configVarKey,
  fields: { token: `token-for-${configVarKey}` },
});

/** Connections only: the configuration reaches an author on its own context key. */
const runtimeConfigVars = () => ({
  orgConnection: connectionValue("orgConnection"),
  customerConnection: connectionValue("customerConnection"),
});

const fixtureShape: HeadlessRuntimeShape = {
  connectionNames: { orgConnection: "orgConnection", customerConnection: "customerConnection" },
};

describe("the function-backed authoring surface", () => {
  it("accepts configuration.schema / eTag / init / connections", () => {
    const { configuration } = headlessConfigurationDefinition as unknown as {
      configuration: Record<string, unknown>;
    };

    expect(configuration.schema).toBeDefined();
    expect(configuration.eTag).toBe(CONFIGURATION_E_TAG);
    expect(typeof configuration.init).toBe("function");
    expect(Object.keys(configuration.connections as object)).toEqual([
      "orgConnection",
      "customerConnection",
    ]);
  });

  it("does not require the author to name config pages or config variables", () => {
    const { configuration } = headlessConfigurationDefinition as unknown as {
      configuration: Record<string, unknown>;
    };

    // The author writes a schema. Nothing else is named.
    expect(configuration.configPages).toBeUndefined();
    expect(configuration.configVars).toBeUndefined();
  });
});

describe("configuration is a platform model, not a config variable", () => {
  it("emits a `configuration:` block in the integration YAML", () => {
    // A peer of requiredConfigVars, not an entry in it.
    const emitted = yaml();

    expect(emitted).toContain("configuration:");
    expect(emitted).toContain(`eTag: ${CONFIGURATION_E_TAG}`);
  });

  it("emits schema and uiSchema as objects, not JSON strings", () => {
    // The platform declares them `map(any(), key=str())`; serializing them, as
    // Action.outputSchema does, fails import validation.
    const emitted = yaml();

    // A serialized schema would appear as a quoted `{"type":"object"...}` blob.
    expect(emitted).not.toContain("schema: '{\"");
    expect(emitted).not.toContain('schema: "{');
    // As a YAML mapping, the schema's own keys are nested lines.
    expect(emitted).toMatch(/schema:\s*\n\s+type: object/);
  });

  it("synthesizes no config page and no config variable for the configuration", () => {
    const emitted = yaml();

    expect(emitted).not.toContain("stableKey: configuration");
    expect(emitted).not.toContain("headlessPage");
    expect(emitted).not.toContain("dataType: code");
    expect(emitted).not.toContain("jsonForm");
  });
});

describe("init rides the component's configuration export, not a data source", () => {
  it("emits the author's init on `configuration`, beside actions and dataSources", () => {
    // Invoked by a bespoke system call, so it has no key or data source ID.
    expect(typeof emittedConfiguration()?.init).toBe("function");
    expect(dataSourceKeys()).not.toContain("configuration");
  });

  it("sets hasConfigurationInit so the platform can discover it", () => {
    // The only discovery mechanism: when false, initialization silently no-ops.
    const { hasConfigurationInit } = convert() as unknown as { hasConfigurationInit?: boolean };

    expect(hasConfigurationInit).toBe(true);
  });

  it("emits no init at all when the author wrote none", () => {
    // Nothing to publish: schema and uiSchema live on the model, so no data
    // source has to exist just to carry them.
    const { configuration, hasConfigurationInit } = noInitIntegration as unknown as {
      configuration?: unknown;
      hasConfigurationInit?: boolean;
    };

    expect(configuration).toBeUndefined();
    expect(hasConfigurationInit).toBe(false);
    expect(Object.keys(noInitIntegration.dataSources ?? {})).toEqual([]);
  });

  it("hands init the assembled configuration on context.configuration", async () => {
    const wrapped = convertHeadlessInit(async ({ configuration }) => ({ seen: configuration }));

    // The schema's defaults with the instance's persisted value over them.
    const assembled = { mappings: [{ source: "a" }] };
    const result = (await wrapped({ configuration: assembled }, {})) as { seen: unknown };

    expect(result.seen).toEqual(assembled);
  });

  it("returns the author's own shape untouched, not the configuration value", async () => {
    // This is how an author hands the host form options or user metadata
    // without a second round trip.
    const authorShape = {
      previousValues: { pairs: [] },
      migratedValues: { mappings: [] },
      formOptions: { objectKeys: ["Contact", "Lead"] },
      user: { greeting: "hi" },
    };
    const wrapped = convertHeadlessInit(async () => authorShape);

    await expect(wrapped({ configuration: {} }, {})).resolves.toEqual(authorShape);
  });

  it("passes undefined before a first save so an author can distinguish seeding", async () => {
    const wrapped = convertHeadlessInit(async ({ configuration }) => ({
      wasUndefined: configuration === undefined,
    }));

    const absent = (await wrapped({}, {})) as { wasUndefined: boolean };

    expect(absent.wasUndefined).toBe(true);
  });

  it("hands init the deployed configuration's etag", async () => {
    // Tells the author which shape the stored value was written under.
    const wrapped = convertHeadlessInit(async ({ configurationEtag }) => ({
      seen: configurationEtag,
    }));

    const result = (await wrapped({
      configuration: {},
      configurationEtag: PREVIOUS_CONFIGURATION_E_TAG,
    })) as { seen: unknown };

    expect(result.seen).toBe(PREVIOUS_CONFIGURATION_E_TAG);
  });

  it("passes null rather than undefined before a first deploy", async () => {
    const wrapped = convertHeadlessInit(async ({ configurationEtag }) => ({
      seen: configurationEtag,
    }));

    const result = (await wrapped({ configuration: {} })) as { seen: unknown };

    expect(result.seen).toBeNull();
  });

  it("takes no positional previousValues argument", async () => {
    // One context, one parameter.
    const seen: unknown[] = [];
    const wrapped = convertHeadlessInit(async (...args: unknown[]) => {
      seen.push(...args);
      return {};
    });

    await wrapped({ configuration: {} }, {});

    expect(seen).toHaveLength(1);
  });
});

describe("one context for init and flows", () => {
  it("hands init the connections under the author's names, not the raw configVars bag", async () => {
    const wrapped = convertHeadlessInit(
      async (context) => ({
        keys: Object.keys(context).sort(),
        connections: context.connections,
      }),
      fixtureShape,
    );

    const result = (await wrapped({ logger: console, configVars: runtimeConfigVars() }, {})) as {
      keys: string[];
      connections: Record<string, unknown>;
    };

    expect(result.connections).toEqual({
      orgConnection: connectionValue("orgConnection"),
      customerConnection: connectionValue("customerConnection"),
    });
    // The bag stays inside the convert layer.
    expect(result.keys).toEqual([
      "configuration",
      "configurationEtag",
      "connections",
      "customer",
      "instance",
      "logger",
    ]);
  });

  it("gives a flow the configuration and the same connections under the same names", async () => {
    const action = Object.values(convert().actions ?? {})[0] as unknown as {
      perform: (context: unknown, params: unknown) => Promise<{ data: unknown }>;
    };

    const { data } = await action.perform(
      {
        logger: console,
        configuration: { mappings: [{ source: "a" }] },
        configVars: runtimeConfigVars(),
      },
      {},
    );

    expect(data).toEqual({ count: 1, connectionNames: ["orgConnection", "customerConnection"] });
  });

  it("gives a flow an empty object rather than throwing on an unconfigured instance", async () => {
    // Reading into it should yield `undefined`, not throw.
    const action = Object.values(convert().actions ?? {})[0] as unknown as {
      perform: (context: unknown, params: unknown) => Promise<{ data: unknown }>;
    };

    const { data } = await action.perform({ logger: console, configVars: runtimeConfigVars() }, {});

    expect(data).toEqual({ count: 0, connectionNames: ["orgConnection", "customerConnection"] });
  });
});

describe("schema and uiSchema are published on the model, not as inputs", () => {
  it("carries the converted JSON Schema in the YAML configuration block", () => {
    const emitted = yaml();

    expect(emitted).toMatch(/mappings:/);
    expect(emitted).toContain(`eTag: ${CONFIGURATION_E_TAG}`);
  });

  it("carries the author's uiSchema verbatim", () => {
    // Including the nested `scope` pointers, which a shallow key check misses.
    const emitted = yaml();

    expect(emitted).toContain(`type: ${configurationUiSchema.type}`);
    for (const element of configurationUiSchema.elements) {
      expect(emitted).toContain(element.scope);
    }
  });

  it("emits no schema, uiSchema or eTag input on any data source", () => {
    // As input defaults these were editable by anyone opening the generated
    // component in the Designer.
    for (const source of Object.values(convert().dataSources ?? {})) {
      const keys = (source.inputs ?? []).map((input) => input.key);

      expect(keys).not.toContain("schema");
      expect(keys).not.toContain("uiSchema");
      expect(keys).not.toContain("version");
      expect(keys).not.toContain("eTag");
    }
  });

  it("declares an `input` channel so a host's argument actually arrives", () => {
    // The platform forwards only inputs a data source declares.
    for (const source of Object.values(convert().dataSources ?? {})) {
      expect((source.inputs ?? []).map((input) => input.key)).toContain("input");
    }
  });

  it("serializes every schema input as valid JSON", () => {
    const { dataSources } = convert();

    for (const source of Object.values(dataSources ?? {})) {
      for (const input of source.inputs ?? []) {
        if (!/^(inputSchema|outputSchema)$/.test(input.key)) continue;

        const raw = (input as { default?: unknown }).default;
        expect(typeof raw).toBe("string");
        expect(() => JSON.parse(raw as string)).not.toThrow();
      }
    }
  });

  it("emits no field the platform's DataSourceDefinitionInput rejects", () => {
    const { dataSources } = convert();

    // An allow-list rather than a check on one name: the platform rejects any
    // field its DataSourceDefinitionInput does not declare.
    const allowed = new Set([
      "key",
      "display",
      "dataSourceType",
      "perform",
      "inputs",
      "examplePayload",
      "detailDataSource",
    ]);

    for (const source of Object.values(dataSources ?? {})) {
      expect(Object.keys(source).filter((key) => !allowed.has(key))).toEqual([]);
    }
  });
});

describe("schemas may be authored in zod or as JSON Schema literals", () => {
  it("converts a zod schema to JSON Schema on the wire", () => {
    const { configuration } = headlessConfigurationDefinition as unknown as {
      configuration: { schema: never };
    };

    expect(toJsonSchema(configuration.schema)).toMatchObject({
      type: "object",
      properties: {
        mappings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source: { type: "string" },
              destination: { type: "string" },
            },
          },
        },
      },
    });
  });

  it("passes a JSON Schema literal through untouched", () => {
    const literal = {
      type: "object",
      required: ["objectKey"],
      properties: { objectKey: { type: "string" } },
    } as const;

    expect(toJsonSchema(literal)).toEqual(literal);
  });

  it("inlines reused subschemas rather than emitting $defs/$ref", () => {
    // A $ref the host cannot resolve is worse than a larger payload.
    const emitted = yaml();

    expect(emitted).not.toContain("$ref");
    expect(emitted).not.toContain("$defs");
  });
});

describe("no implicit cascade", () => {
  it("does not synthesize configVar dependency placeholder inputs", () => {
    // The declared surface synthesizes `input0`, `input1`, … so the wizard can
    // detect upstream changes and reset. There is no implicit cascade here.
    for (const source of Object.values(convert().dataSources ?? {})) {
      const keys = (source.inputs ?? []).map((input) => input.key);
      expect(keys.filter((key) => /^input\d+$/.test(key))).toHaveLength(0);
    }
  });

  it("does not set dataSourceReset metadata anywhere", () => {
    expect(yaml()).not.toContain("dataSourceReset");
  });
});

describe("connections", () => {
  it("emits each declared connection as a useScopedConfigVar reference", () => {
    const emitted = yaml();

    for (const stableKey of [ORG_CONNECTION_STABLE_KEY, CUSTOMER_CONNECTION_STABLE_KEY]) {
      expect(emitted).toContain(stableKey);
    }
    expect(emitted).toContain("useScopedConfigVar");
  });

  it("does not emit any inline connection definition", () => {
    // Connections are managed outside the configuration; there must be no way to
    // collect credentials in-flow.
    expect(convert().connections ?? []).toHaveLength(0);
  });

  it("offers no API for inline credential collection", () => {
    const { configuration } = headlessConfigurationDefinition as unknown as {
      configuration: { connections: Record<string, Record<string, unknown>> };
    };

    // An `inputs` key would mean credential collection had crept back in.
    for (const connection of Object.values(configuration.connections)) {
      expect(connection).toEqual({
        dataType: "connection",
        stableKey: expect.any(String),
      });
      expect(connection.inputs).toBeUndefined();
      expect(connection.oauth2Type).toBeUndefined();
    }
  });
});
