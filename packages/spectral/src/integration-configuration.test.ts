import { describe, expect, it } from "vitest";

import {
  CONFIGURATION_E_TAG,
  CUSTOMER_CONNECTION_STABLE_KEY,
  type configurationSchema,
  configurationUiSchema,
  configuredIntegration,
  INLINE_CONNECTION_STABLE_KEY,
  integrationConfigurationDefinition,
  noInitIntegration,
  ORG_CONNECTION_STABLE_KEY,
  PREVIOUS_CONFIGURATION_E_TAG,
  searchChannels,
} from "./integration-configuration.fixture";
import type { ConnectionNameMap } from "./serverTypes/configurationContext";
import { toJsonSchema } from "./serverTypes/configurationSchema";
import {
  convertConfigurationInit,
  convertServerFunction,
  type ServerFunctionDefinition,
} from "./serverTypes/convertIntegrationConfiguration";
import type { ConfigurationValue, SchemaInput } from "./types/IntegrationConfiguration";

/**
 * Drift guards for integration configuration. The negative tests carry the weight:
 * a positive test says "this works", a negative one says "this must not become
 * possible."
 */

/** `integration()` already converted the fixture; this is the emitted component. */
const convert = () => configuredIntegration;

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

/** The component's `serverFunctions` export, which the runner calls by key. */
const emittedServerFunctions = () =>
  (
    convert() as unknown as {
      serverFunctions?: Record<string, (context: unknown, inputs: unknown) => Promise<unknown>>;
    }
  ).serverFunctions;

const serverFunctionDefinitions = (): ServerFunctionDefinition[] =>
  (convert() as unknown as { serverFunctionDefinitions?: ServerFunctionDefinition[] })
    .serverFunctionDefinitions ?? [];

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

const fixtureConnectionNames: ConnectionNameMap = {
  orgConnection: "orgConnection",
  customerConnection: "customerConnection",
};

/**
 * `ConfiguredValue` and `ConfiguredConnections` resolve through module
 * augmentation, which is global to a compilation. Asserting the resolution
 * directly keeps that out of the rest of the suite.
 */
type Augmented = { schema: typeof configurationSchema; connections: { crm: never } };
type Value = Augmented extends { schema: infer TSchema extends SchemaInput }
  ? ConfigurationValue<TSchema>
  : never;

describe("a flow reads the configuration typed by its schema", () => {
  it("resolves the schema's value, not unknown", () => {
    const value: Value = { mappings: [{ source: "Name", destination: "full_name" }] };

    // Fails to compile if `Value` widened to `unknown`.
    expect(value.mappings[0].source).toBe("Name");
  });

  it("keys connections by the names the integration declared", () => {
    const connections: { [Key in keyof Augmented["connections"]]: string } = { crm: "resolved" };

    expect(Object.keys(connections)).toEqual(["crm"]);
  });
});

describe("the integration configuration authoring surface", () => {
  it("accepts configuration.schema / eTag / init / connections", () => {
    const { configuration } = integrationConfigurationDefinition as unknown as {
      configuration: Record<string, unknown>;
    };

    expect(configuration.schema).toBeDefined();
    expect(configuration.eTag).toBe(CONFIGURATION_E_TAG);
    expect(typeof configuration.init).toBe("function");
    expect(Object.keys(configuration.connections as object)).toEqual([
      "orgConnection",
      "customerConnection",
      "inlineConnection",
    ]);
  });

  it("does not require the author to name config pages or config variables", () => {
    const { configuration } = integrationConfigurationDefinition as unknown as {
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
    expect(emitted).not.toContain("configurationPage");
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
    const wrapped = convertConfigurationInit(async ({ configuration }) => ({
      seen: configuration,
    }));

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
    const wrapped = convertConfigurationInit(async () => authorShape);

    await expect(wrapped({ configuration: {} }, {})).resolves.toEqual(authorShape);
  });

  it("reports an empty stored configuration as undefined before a first deploy", async () => {
    // The runner sends `request.configuration || {}`, so a never-configured
    // instance arrives as `{}`. Only `undefined` distinguishes it from one
    // migrating off `configPages`, which reaches `init` under the same etag.
    const wrapped = convertConfigurationInit(async ({ configuration }) => ({
      wasUndefined: configuration === undefined,
    }));

    const result = (await wrapped({ configuration: {}, configurationEtag: null })) as {
      wasUndefined: boolean;
    };

    expect(result.wasUndefined).toBe(true);
  });

  it("folds config vars onto the configuration before a first deploy", async () => {
    // An author migrating off a headed configuration reads one place, not two.
    const wrapped = convertConfigurationInit(async ({ configuration }) => ({
      seen: configuration,
    }));

    const result = (await wrapped({
      configuration: {},
      configurationEtag: null,
      configVars: { objectKey: "Contact", region: "us-east" },
    })) as { seen: Record<string, unknown> };

    expect(result.seen).toEqual({ objectKey: "Contact", region: "us-east" });
  });

  it("keeps a stored value over a config var of the same name", async () => {
    // Only a value the platform kept is authoritative.
    const wrapped = convertConfigurationInit(async ({ configuration }) => ({
      seen: configuration,
    }));

    const result = (await wrapped({
      configuration: { objectKey: "Stored" },
      configurationEtag: null,
      configVars: { objectKey: "FromConfigVars", region: "us-east" },
    })) as { seen: Record<string, unknown> };

    expect(result.seen).toEqual({ objectKey: "Stored", region: "us-east" });
  });

  it("leaves the configuration alone once an etag is deployed", async () => {
    // Config vars are folded in only before a first deploy.
    const wrapped = convertConfigurationInit(async ({ configuration }) => ({
      seen: configuration,
    }));

    const result = (await wrapped({
      configuration: { mappings: [] },
      configurationEtag: PREVIOUS_CONFIGURATION_E_TAG,
      configVars: { objectKey: "Contact" },
    })) as { seen: Record<string, unknown> };

    expect(result.seen).toEqual({ mappings: [] });
  });

  it("passes undefined before a first save so an author can distinguish seeding", async () => {
    const wrapped = convertConfigurationInit(async ({ configuration }) => ({
      wasUndefined: configuration === undefined,
    }));

    const absent = (await wrapped({}, {})) as { wasUndefined: boolean };

    expect(absent.wasUndefined).toBe(true);
  });

  it("hands init the deployed configuration's etag", async () => {
    // Tells the author which shape the stored value was written under.
    const wrapped = convertConfigurationInit(async ({ configurationEtag }) => ({
      seen: configurationEtag,
    }));

    const result = (await wrapped({
      configuration: {},
      configurationEtag: PREVIOUS_CONFIGURATION_E_TAG,
    })) as { seen: unknown };

    expect(result.seen).toBe(PREVIOUS_CONFIGURATION_E_TAG);
  });

  it("hands init the config vars an instance was configured under", async () => {
    const wrapped = convertConfigurationInit(async ({ configVars }) => ({ seen: configVars }));

    const result = (await wrapped({
      configuration: {},
      configVars: { objectKey: "Contact", crmConnection: { configVarKey: "crm", fields: {} } },
    })) as { seen: Record<string, unknown> };

    expect(result.seen.objectKey).toBe("Contact");
    expect(result.seen.crmConnection).toEqual({ configVarKey: "crm", fields: {} });
  });

  it("passes an empty bag when an instance has no config vars", async () => {
    const wrapped = convertConfigurationInit(async ({ configVars }) => ({ seen: configVars }));

    const result = (await wrapped({ configuration: {} })) as { seen: unknown };

    expect(result.seen).toEqual({});
  });

  it("passes null rather than undefined before a first deploy", async () => {
    const wrapped = convertConfigurationInit(async ({ configurationEtag }) => ({
      seen: configurationEtag,
    }));

    const result = (await wrapped({ configuration: {} })) as { seen: unknown };

    expect(result.seen).toBeNull();
  });

  it("takes no positional previousValues argument", async () => {
    // One context, one parameter.
    const seen: unknown[] = [];
    const wrapped = convertConfigurationInit(async (...args: unknown[]) => {
      seen.push(...args);
      return {};
    });

    await wrapped({ configuration: {} }, {});

    expect(seen).toHaveLength(1);
  });
});

describe("one context for init and flows", () => {
  it("hands init the connections under the author's names", async () => {
    const wrapped = convertConfigurationInit(
      async (context) => ({
        keys: Object.keys(context).sort(),
        connections: context.connections,
      }),
      fixtureConnectionNames,
    );

    const result = (await wrapped({ logger: console, configVars: runtimeConfigVars() }, {})) as {
      keys: string[];
      connections: Record<string, unknown>;
    };

    expect(result.connections).toEqual({
      orgConnection: connectionValue("orgConnection"),
      customerConnection: connectionValue("customerConnection"),
    });
    expect(result.keys).toEqual([
      "configVars",
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

  it("omits uiSchema when the author wrote none", () => {
    // The platform stores absence as null, so emitting a bare layout would
    // claim the author chose one.
    const { codeNativeIntegrationYAML } = noInitIntegration as unknown as {
      codeNativeIntegrationYAML: string;
    };

    expect(codeNativeIntegrationYAML).not.toContain("uiSchema");
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
    const { configuration } = integrationConfigurationDefinition as unknown as {
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
  it("emits a reusable connection as a useScopedConfigVar pointer", () => {
    const emitted = yaml();

    for (const stableKey of [ORG_CONNECTION_STABLE_KEY, CUSTOMER_CONNECTION_STABLE_KEY]) {
      expect(emitted).toContain(stableKey);
    }
    expect(emitted).toContain("useScopedConfigVar");
  });

  it("gives a reusable connection no connection on the generated component", () => {
    // It points at something the platform already holds, so there is nothing
    // for the component to own.
    const keys = (convert().connections ?? []).map((connection) => connection.key);

    expect(keys).not.toContain("orgConnection");
    expect(keys).not.toContain("customerConnection");
  });

  it("emits an integration-specific connection with its inputs", () => {
    // The platform collects these, so they ride requiredConfigVars rather than
    // pointing at a scoped config var.
    const emitted = yaml();

    expect(emitted).toContain(INLINE_CONNECTION_STABLE_KEY);
    expect(emitted).toMatch(/key: inlineConnection/);
    expect(emitted).toContain("apiKey");
  });

  it("also emits an integration-specific connection on the generated component", () => {
    // Both halves are required, and their keys have to agree: the config var's
    // `connection.key` names the component connection the platform collects.
    const connection = (convert().connections ?? []).find(
      (candidate) => candidate.key === "inlineConnection",
    );

    expect(connection).toBeDefined();
    expect((connection?.inputs ?? []).map((input) => input.key)).toEqual(["apiKey", "endpoint"]);
    expect(yaml()).toMatch(/connection:\n\s+key: inlineConnection/);
  });

  it("hands every kind to a flow under the author's own name", async () => {
    const action = Object.values(convert().actions ?? {})[0] as unknown as {
      perform: (context: unknown, params: unknown) => Promise<{ data: unknown }>;
    };

    const { data } = await action.perform(
      {
        logger: console,
        configuration: { mappings: [] },
        configVars: {
          ...runtimeConfigVars(),
          inlineConnection: connectionValue("inlineConnection"),
        },
      },
      {},
    );

    expect((data as { connectionNames: string[] }).connectionNames).toEqual([
      "orgConnection",
      "customerConnection",
      "inlineConnection",
    ]);
  });
});

describe("server functions", () => {
  it("emits each one on the component, keyed as the author named it", () => {
    expect(Object.keys(emittedServerFunctions() ?? {})).toEqual(["searchChannels", "listRegions"]);
  });

  it("keeps them off dataSources", () => {
    // They are a bespoke system invocation; riding dataSources is what the
    // platform moved away from.
    expect(dataSourceKeys()).not.toContain("searchChannels");
  });

  it("omits the export when the author declared none", () => {
    expect(
      (noInitIntegration as unknown as { serverFunctions?: unknown }).serverFunctions,
    ).toBeUndefined();
  });

  it("publishes both schemas as JSON strings", () => {
    // They ride their own mutation variable as JSONString, unlike the
    // configuration schema, which is an object in the YAML.
    const [definition] = serverFunctionDefinitions();

    expect(JSON.parse(definition.inputSchema)).toMatchObject({
      properties: { search: { type: "string" } },
    });
    expect(JSON.parse(definition.outputSchema)).toMatchObject({ type: "array" });
  });

  it("falls back to the key when the author wrote no label", () => {
    const definition = serverFunctionDefinitions().find(({ key }) => key === "listRegions");

    expect(definition?.display).toEqual({ label: "listRegions", description: "" });
  });

  it("carries the author's label and description when given", () => {
    const definition = serverFunctionDefinitions().find(({ key }) => key === "searchChannels");

    expect(definition?.display).toEqual({
      label: "Search Channels",
      description: "Lists channels matching a search string",
    });
  });

  it("hands perform the connections under the author's names", async () => {
    const wrapped = convertServerFunction(searchChannels as never, fixtureConnectionNames);

    const result = await wrapped({ configVars: runtimeConfigVars() }, { search: "org" });

    expect(result).toEqual([{ id: "orgConnection", name: "orgConnection" }]);
  });

  it("passes inputs through as params", async () => {
    const wrapped = convertServerFunction(
      { ...searchChannels, perform: async (_context, params) => params } as never,
      fixtureConnectionNames,
    );

    expect(await wrapped({ configVars: {} }, { search: "anything" })).toEqual({
      search: "anything",
    });
  });

  it("invokes a registry component through the runner's invoker", async () => {
    const invoked: unknown[] = [];
    const registry = {
      slack: {
        key: "slack",
        public: true,
        signature: "sig",
        actions: { listChannels: { key: "listChannels", inputs: {} } },
      },
    };
    const wrapped = convertServerFunction(
      {
        ...searchChannels,
        perform: async ({ components }) =>
          (
            components as never as Record<string, Record<string, (values: unknown) => unknown>>
          ).slack.listChannels({ search: "general" }),
      } as never,
      fixtureConnectionNames,
      registry as never,
    );

    await wrapped(
      {
        configVars: {},
        _components: {
          invoke: (...args: unknown[]) => {
            invoked.push(args);
            return Promise.resolve({ data: "ok" });
          },
        },
      },
      {},
    );

    expect(invoked).toHaveLength(1);
  });

  it("resolves a component action to undefined when the runner supplied no invoker", async () => {
    // The fallback is silent by design in createCNIContext; this pins that a
    // server function outside an extended scope degrades rather than throwing.
    const wrapped = convertServerFunction(
      {
        ...searchChannels,
        perform: async ({ components }) =>
          (
            components as never as Record<string, Record<string, (values: unknown) => unknown>>
          ).slack.listChannels({}),
      } as never,
      fixtureConnectionNames,
      {
        slack: {
          key: "slack",
          public: true,
          signature: "sig",
          actions: { listChannels: { key: "listChannels", inputs: {} } },
        },
      } as never,
    );

    expect(await wrapped({ configVars: {} }, {})).toBeUndefined();
  });

  it("publishes the connections a function declared", () => {
    const definition = serverFunctionDefinitions().find(({ key }) => key === "searchChannels");

    expect(definition?.connections).toEqual(["orgConnection"]);
  });

  it("omits connections when a function declared none", () => {
    // The platform demands a value for every name published here, so an empty
    // list and an absent one are not the same thing.
    const definition = serverFunctionDefinitions().find(({ key }) => key === "listRegions");

    expect(definition).not.toHaveProperty("connections");
  });

  it("withholds the configuration from the context", async () => {
    // A host invokes these mid-configuration, so the saved value is stale;
    // in-progress values arrive as params instead.
    const wrapped = convertServerFunction(
      { ...searchChannels, perform: async (context) => context } as never,
      fixtureConnectionNames,
    );

    const context = (await wrapped(
      { configVars: runtimeConfigVars(), configuration: { mappings: [] } },
      { search: "" },
    )) as Record<string, unknown>;

    expect(context).not.toHaveProperty("configuration");
    expect(Object.keys(context).sort()).toEqual([
      "components",
      "connections",
      "customer",
      "instance",
      "logger",
    ]);
  });
});
