import {
  type ActionContext,
  action,
  type Connection,
  component,
  componentClient,
  connection,
  type DataSourceResult,
  dataSource,
  flow,
  input,
  type TriggerPayload,
  trigger,
  util,
} from "@prismatic-io/spectral";
import type { Action, Component } from "@prismatic-io/spectral/dist/serverTypes";
import { expectAssignable, expectError, expectType } from "tsd";

const built = component({
  key: "typed-client",
  public: false,
  display: { label: "Typed client", description: "Typed client", iconPath: "icon.png" },
  actions: {
    create: action({
      display: { label: "Create", description: "Create" },
      inputs: {
        name: input({ label: "Name", type: "string", required: true, clean: util.types.toString }),
        count: input({ label: "Count", type: "number", default: "1" }),
      },
      perform: async (_context, { name, count }) => ({ data: { name, count } }),
    }),
    ping: action({
      display: { label: "Ping", description: "Ping" },
      inputs: {},
      perform: async () => ({ data: "pong" as const }),
    }),
  },
  triggers: {
    webhook: trigger({
      display: { label: "Webhook", description: "Webhook" },
      inputs: { secret: input({ label: "Secret", type: "string", required: true }) },
      scheduleSupport: "invalid",
      synchronousResponseSupport: "valid",
      perform: async (_context, payload) => ({ payload }),
    }),
  },
  dataSources: {
    projects: dataSource({
      display: { label: "Projects", description: "Projects" },
      inputs: { connection: input({ label: "Connection", type: "connection", required: true }) },
      dataSourceType: "picklist",
      perform: async () => ({ result: [] }),
    }),
  },
  connections: [
    connection({
      key: "apiKey",
      display: { label: "API key", description: "API key" },
      inputs: { token: input({ label: "Token", type: "password", required: true }) },
    }),
  ],
});

// The built component is still the erased server component the platform publishes and runs,
// and it carries its definition.
expectAssignable<Component>(built);
expectAssignable<Action>(built.actions.create);
expectType<"typed-client">(built.definition.key);
expectType<"apiKey">(built.definition.connections[0].key);

const client = componentClient(built);

// Actions: typed from the definition, optional where the definition allows.
expectType<Promise<{ data: { name: string; count: number } }>>(
  client.actions.create({ name: "Ada" }),
);
expectType<Promise<{ data: "pong" }>>(client.actions.ping());
expectError(client.actions.create({}));
expectError(client.actions.create({ name: "Ada", unknown: true }));
expectError(client.actions.missing);

// Triggers bind their inputs and become a flow's own trigger; each trigger function is also
// callable in-process. Data sources are callable in-process and `.configVar` hoists one onto
// the integration's wrapper component. Connections reference the published component.
const boundWebhook = client.triggers.webhook({ secret: { configVar: "Secret" } });
expectAssignable<(context: ActionContext, payload: TriggerPayload) => unknown>(boundWebhook);
flow({
  name: "Bound",
  stableKey: "bound",
  onTrigger: boundWebhook,
  onExecution: async () => ({ data: true }),
});
client.triggers.webhook({ secret: "s" });
client.triggers.webhook({ secret: { value: "s" } });
expectError(client.triggers.webhook());
expectError(client.triggers.webhook({ secret: { configVar: 3 } }));
expectError(client.triggers.webhook({ missing: { value: "nope" } }));
expectType<Promise<{ payload: TriggerPayload }>>(
  client.triggers.webhook.perform({} as TriggerPayload, { secret: "s" }),
);
expectError(client.triggers.webhook.perform({} as TriggerPayload));
expectType<Promise<DataSourceResult<"picklist">>>(
  client.dataSources.projects({ connection: {} as Connection }),
);
expectError(client.dataSources.projects());
expectType<true>(
  client.dataSources.projects.configVar({ stableKey: "projects" }).dataSource
    .__bundledDataSourceReference,
);
expectError(client.dataSources.missing);
expectType<"connection">(client.connections.apiKey({ stableKey: "api-key" }).connection.kind);
expectError(client.connections.missing);

// The client needs the object component() returns, not a plain definition.
expectError(componentClient(built.definition));

// Caller-side input values: what may be passed before the component's cleaner runs.
const typed = component({
  key: "typed-inputs",
  display: { label: "Typed", description: "Typed", iconPath: "icon.png" },
  actions: {
    run: action({
      display: { label: "Run", description: "Run" },
      inputs: {
        name: input({ label: "Name", type: "string" }),
        enabled: input({ label: "Enabled", type: "boolean" }),
        size: input({ label: "Size", type: "number" }),
        tags: input({ label: "Tags", type: "string", collection: "valuelist" }),
        headers: input({ label: "Headers", type: "string", collection: "keyvaluelist" }),
        raw: input({ label: "Raw", type: "data" }),
        parsed: input({ label: "Parsed", type: "data", clean: (value) => value }),
        selection: input({ label: "Selection", type: "objectSelection" }),
      },
      perform: async () => ({ data: true }),
    }),
  },
});
const typedClient = componentClient(typed);
typedClient.actions.run({
  name: "n",
  enabled: true,
  size: 3,
  tags: ["a"],
  headers: { Authorization: "Bearer" },
  raw: "{}",
  parsed: { anything: 1 },
  selection: [{ object: { key: "k" } }],
});
typedClient.actions.run({ enabled: "false", size: "3", headers: [{ key: "a", value: "b" }] });
expectError(typedClient.actions.run({ name: 1 }));
expectError(typedClient.actions.run({ enabled: 1 }));
expectError(typedClient.actions.run({ raw: { notAString: true } }));
expectError(typedClient.actions.run({ tags: "a" }));
