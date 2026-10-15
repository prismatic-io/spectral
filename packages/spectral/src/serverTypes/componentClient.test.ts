import { describe, expect, it, vi } from "vitest";
import {
  action,
  component,
  componentClient,
  configPage,
  connection,
  dataSource,
  dataSourceConfigVar,
  flow,
  input,
  integration,
  trigger,
} from "..";
import { runWithContext } from "./asyncContext";
import { createCNIContext } from "./context";
import { convertConfigVar, convertFlow } from "./convertIntegration";

const perform = vi.fn(async (_context: unknown, params: Record<string, unknown>) => ({
  data: params,
}));

const built = component({
  key: "acme",
  public: false,
  display: { label: "Acme", description: "Acme", iconPath: "icon.png" },
  actions: {
    echo: action({
      display: { label: "Echo", description: "Echo" },
      inputs: {
        message: input({ label: "Message", type: "string", required: true }),
        prefix: input({ label: "Prefix", type: "string", default: "hello" }),
        count: input({ label: "Count", type: "string", default: "2", clean: (v) => Number(v) }),
      },
      perform,
    }),
  },
  triggers: {
    webhook: trigger({
      display: { label: "Webhook", description: "Webhook" },
      inputs: { secret: input({ label: "Secret", type: "string" }) },
      scheduleSupport: "invalid",
      synchronousResponseSupport: "valid",
      perform: async (_context, payload) => ({ payload }),
    }),
  },
  dataSources: {
    projects: dataSource({
      display: { label: "Projects", description: "Projects" },
      inputs: { query: input({ label: "Query", type: "string" }) },
      dataSourceType: "picklist",
      perform: async () => ({ result: [] }),
    }),
  },
  connections: [
    connection({
      key: "apiKey",
      display: { label: "API key", description: "API key" },
      inputs: { token: input({ label: "Token", type: "password" }) },
    }),
  ],
});

const client = componentClient(built);

describe("componentClient actions", () => {
  it("run the bundled implementation in-process, with defaults and cleaners applied", async () => {
    const context = { globalDebug: false } as never;
    const result = await runWithContext(context, () => client.actions.echo({ message: "hi" }));

    expect(result).toEqual({ data: { message: "hi", prefix: "hello", count: 2 } });
    expect(perform).toHaveBeenCalledTimes(1);
    expect(perform.mock.calls[0][0]).toMatchObject({ globalDebug: false });
  });

  it("hand a boolean input to perform as its serialized string, as the platform does", async () => {
    const seen = vi.fn(async (_context: unknown, params: Record<string, unknown>) => ({
      data: params,
    }));
    const flags = componentClient(
      component({
        key: "flags",
        display: { label: "Flags", description: "Flags", iconPath: "icon.png" },
        actions: {
          set: action({
            display: { label: "Set", description: "Set" },
            inputs: {
              enabled: input({ label: "Enabled", type: "boolean" }),
              each: input({ label: "Each", type: "boolean", collection: "valuelist" }),
              keyed: input({ label: "Keyed", type: "boolean", collection: "keyvaluelist" }),
            },
            perform: seen,
          }),
        },
      }),
    );
    const result = await runWithContext({ globalDebug: false } as never, () =>
      flags.actions.set({ enabled: true, each: [false, "true"], keyed: { a: false } }),
    );
    expect(result).toEqual({
      data: { enabled: "true", each: ["false", "true"], keyed: [{ key: "a", value: "false" }] },
    });
  });

  it("fail clearly outside an execution", async () => {
    await expect(client.actions.echo({ message: "hi" })).rejects.toThrow("ActionContext not found");
  });

  it("work inside a converted flow without any runner involvement", async () => {
    const converted = integration({
      name: "Bundled Flow",
      description: "Calls a bundled component action",
      iconPath: "icon.png",
      componentRegistry: {},
      flows: [
        flow({
          name: "Echo Flow",
          stableKey: "echo-flow",
          description: "echo",
          onExecution: async () => ({ data: await client.actions.echo({ message: "flow" }) }),
        }),
      ],
    });
    const [onExecution] = Object.values(converted.actions);
    const result = await onExecution.perform(
      { globalDebug: false, configVars: {}, logger: console } as never,
      { onTrigger: { results: {} } },
    );
    expect(result).toEqual({ data: { data: { message: "flow", prefix: "hello", count: 2 } } });
  });
});

describe("componentClient actions called from other handlers", () => {
  it("resolve the ambient context from a flow's own trigger and from a data source", async () => {
    const converted = integration({
      name: "Handlers",
      description: "Calls a bundled action from a trigger and a data source",
      iconPath: "icon.png",
      componentRegistry: {},
      configPages: {
        Settings: configPage({
          elements: {
            Options: dataSourceConfigVar({
              stableKey: "options",
              dataSourceType: "picklist",
              perform: async () => ({
                result: [(await client.actions.echo({ message: "from data source" })) as never],
              }),
            }),
          },
        }),
      },
      flows: [
        flow({
          name: "Triggered",
          stableKey: "triggered",
          description: "t",
          onTrigger: async (_context, payload) => ({
            payload: {
              ...payload,
              body: { data: await client.actions.echo({ message: "from trigger" }) },
            },
          }),
          onExecution: async (_context, params) => ({ data: params.onTrigger.results.body.data }),
        }),
      ],
    });
    const context = { globalDebug: false, configVars: {}, logger: console } as never;
    const payload = { headers: {}, queryParameters: {}, rawBody: { data: "" }, body: { data: "" } };

    const [triggerPerform] = Object.values(converted.triggers).map((t) => t.perform);
    const triggered = await triggerPerform(context, payload as never, {});
    expect(triggered?.payload.body.data).toEqual({
      data: { message: "from trigger", prefix: "hello", count: 2 },
    });

    const [dataSourcePerform] = Object.values(converted.dataSources).map((d) => d.perform);
    expect(await dataSourcePerform(context, {})).toEqual({
      result: [{ data: { message: "from data source", prefix: "hello", count: 2 } }],
    });
  });
});

describe("componentClient triggers and data sources", () => {
  it("become triggers on the integration's own wrapper component", () => {
    const reference = client.triggers.webhook({ secret: { value: "s3cret" } });
    expect(reference.__bundledTriggerReference).toBe(true);
    expect(reference.trigger).toBe(built.triggers.webhook);

    const converted = convertFlow(
      {
        name: "Events",
        stableKey: "events",
        onTrigger: reference,
        onExecution: async () => ({ data: null }),
      },
      {},
      "integration",
    );
    const [triggerStep] = converted.steps as Array<Record<string, unknown>>;
    expect(triggerStep).toMatchObject({
      action: { component: { key: "integration" }, key: "events_onTrigger" },
      inputs: { secret: { type: "value", value: "s3cret" } },
    });
  });

  it("become data sources hoisted onto the wrapper component", () => {
    const converted = convertConfigVar(
      "Projects",
      client.dataSources.projects({
        stableKey: "projects",
        values: { query: { value: "active" } },
      }),
      "integration",
      {},
    );
    expect(converted).toMatchObject({
      dataType: "picklist",
      dataSource: { component: { key: "integration" }, key: "projects" },
      inputs: { query: { type: "value", value: "active" } },
    });
  });
});

describe("componentClient connections", () => {
  it("reference the published component rather than carrying a copy", () => {
    const configVar = client.connections.apiKey({
      stableKey: "api-key",
      values: { token: { value: "t" } },
    });
    expect(configVar.connection).toMatchObject({
      kind: "connection",
      component: { key: "acme", isPublic: false },
      key: "apiKey",
    });
    expect(convertConfigVar("API key", configVar, "integration", {})).toMatchObject({
      dataType: "connection",
      connection: { component: { key: "acme", isPublic: false, version: "LATEST" }, key: "apiKey" },
    });
  });
});

describe("componentClient input", () => {
  it("takes the object component() returns and refuses a copy that lost its definition", () => {
    expect(() => componentClient({ ...built } as never)).toThrow("Spreading or serializing");
  });

  it("carries the definition invisibly to everything that publishes or loads the component", () => {
    expect(built.definition.actions.echo.inputs.message.required).toBe(true);
    expect(Object.keys(built)).not.toContain("definition");
    expect(JSON.parse(JSON.stringify(built))).not.toHaveProperty("definition");
  });
});

describe("createCNIContext", () => {
  it("keeps the runner's non-enumerable _components on the context", () => {
    const context = { globalDebug: false } as Record<string, unknown>;
    const internal = { invoke: vi.fn() };
    Object.defineProperty(context, "_components", {
      value: internal,
      configurable: false,
      enumerable: false,
      writable: false,
    });
    const cniContext = createCNIContext(context as never, {});
    expect((cniContext as Record<string, unknown>)._components).toBe(internal);
    expect(Object.keys(cniContext)).not.toContain("_components");
  });
});
