import { describe, expect, it, vi } from "vitest";
import {
  action,
  component,
  componentClient,
  connection,
  dataSource,
  flow,
  input,
  integration,
  trigger,
} from "..";
import { runWithContext } from "./asyncContext";
import { convertConfigVar, convertFlow } from "./convertIntegration";

const localPerform = vi.fn(async () => ({ data: "local" }));

const definition = {
  key: "acme",
  public: false,
  display: { label: "Acme", description: "Acme", iconPath: "icon.png" },
  actions: {
    echo: action({
      display: { label: "Echo", description: "Echo" },
      inputs: {
        message: input({ label: "Message", type: "string", required: true }),
        prefix: input({ label: "Prefix", type: "string", default: "hello" }),
      },
      perform: localPerform,
    }),
  },
};

describe("componentClient", () => {
  it("invokes the published platform action and never the local implementation", async () => {
    const invoke = vi.fn(async () => ({ data: "platform" }));
    const client = componentClient(definition);
    const context = {
      _components: { invoke },
      globalDebug: false,
      runnerAllocatedMemoryMb: 1024,
    } as never;

    await expect(
      runWithContext(context, () => client.actions.echo({ message: "world" })),
    ).resolves.toEqual({ data: "platform" });

    expect(localPerform).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith(
      {
        component: { key: "acme", isPublic: false },
        key: "echo",
      },
      expect.objectContaining({ debug: expect.objectContaining({ enabled: false }) }),
      { message: "world", prefix: "hello" },
    );
  });

  it("fails explicitly when used outside a platform execution", async () => {
    const client = componentClient(definition);
    await expect(client.actions.echo({ message: "world" })).rejects.toThrow(
      "ActionContext not found",
    );
  });

  it("emits platform-scoped trigger, data source, and connection references", () => {
    const referenceClient = componentClient({
      key: "references",
      public: false,
      display: { label: "References", description: "References", iconPath: "icon.png" },
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

    const convertedFlow = convertFlow(
      {
        name: "Events",
        stableKey: "events",
        onTrigger: referenceClient.triggers.webhook({ secret: { value: "secret" } }),
        onExecution: async () => ({ data: null }),
      },
      {},
      "integration",
    );
    expect((convertedFlow.steps as Array<Record<string, unknown>>)[0]).toMatchObject({
      action: {
        component: { key: "references", isPublic: false },
        key: "webhook",
      },
      inputs: { secret: { type: "value", value: "secret" } },
    });

    expect(
      convertConfigVar(
        "Projects",
        referenceClient.dataSources.projects({
          stableKey: "projects",
          values: { query: { value: "active" } },
        }),
        "integration",
        {},
      ),
    ).toMatchObject({
      dataType: "picklist",
      dataSource: { component: { key: "references" }, key: "projects" },
    });
    expect(
      convertConfigVar(
        "API key",
        referenceClient.connections.apiKey({ stableKey: "api-key" }),
        "integration",
        {},
      ),
    ).toMatchObject({
      dataType: "connection",
      connection: { component: { key: "references" }, key: "apiKey" },
    });
  });
});

describe("component().definition", () => {
  const built = component(definition);

  it("carries the definition the converted component was built from", () => {
    expect(built.definition).toBe(definition);
    expect(built.definition.actions.echo.inputs.message.required).toBe(true);
  });

  it("is invisible to everything that publishes or loads the converted component", () => {
    // prism components:publish spreads the component and picks known keys; the runner
    // destructures `actions`/`triggers`/`dataSources`; both are blind to non-enumerables.
    expect(Object.keys(built)).not.toContain("definition");
    expect({ ...built }).not.toHaveProperty("definition");
    expect(JSON.parse(JSON.stringify(built))).not.toHaveProperty("definition");
    expect(Object.keys(built.actions.echo.inputs.map((i) => i.key))).toHaveLength(2);
  });

  it("builds a client from a shape-only descriptor derived from the definition", async () => {
    // What a component's npm build generates: keys and inputs, no implementation.
    const descriptor = {
      key: built.definition.key,
      public: built.definition.public,
      actions: Object.fromEntries(
        Object.entries(built.definition.actions).map(([key, { inputs }]) => [key, { inputs }]),
      ),
    };
    const client = componentClient<typeof built.definition>(descriptor);
    const invoke = vi.fn(async () => ({ data: "platform" }));
    await runWithContext({ _components: { invoke }, globalDebug: false } as never, () =>
      client.actions.echo({ message: "world" }),
    );
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({ key: "echo" }),
      expect.anything(),
      { message: "world", prefix: "hello" },
    );
    expect(localPerform).not.toHaveBeenCalled();
  });
});

describe("componentClient inside a converted flow", () => {
  it("reaches the runner's non-enumerable _components through the ambient context", async () => {
    const client = componentClient(definition);
    const converted = integration({
      name: "Client Flow",
      description: "Calls an npm component client",
      iconPath: "icon.png",
      componentRegistry: {},
      flows: [
        flow({
          name: "Echo Flow",
          stableKey: "echo-flow",
          description: "echo",
          onExecution: async () => ({ data: await client.actions.echo({ message: "hi" }) }),
        }),
      ],
    });

    const invoke = vi.fn(async () => ({ data: "platform" }));
    const context = { globalDebug: false, configVars: {}, logger: console } as Record<
      string,
      unknown
    >;
    // The runner attaches `_components` exactly like this: non-enumerable, non-writable.
    Object.defineProperty(context, "_components", {
      value: { invoke },
      configurable: false,
      enumerable: false,
      writable: false,
    });

    const [onExecution] = Object.values(converted.actions);
    const result = await onExecution.perform(context as never, { onTrigger: { results: {} } });

    expect(result).toEqual({ data: { data: "platform" } });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
