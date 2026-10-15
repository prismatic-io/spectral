import {
  action,
  component,
  componentClient,
  connection,
  dataSource,
  input,
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

// Triggers and data sources are bundled references; connections reference the published
// component.
expectType<true>(client.triggers.webhook({ secret: { value: "s" } }).__bundledTriggerReference);
expectError(client.triggers.webhook({ missing: { value: "nope" } }));
expectType<true>(
  client.dataSources.projects({ stableKey: "projects" }).dataSource.__bundledDataSourceReference,
);
expectError(client.dataSources.missing);
expectType<"connection">(client.connections.apiKey({ stableKey: "api-key" }).connection.kind);
expectError(client.connections.missing);

// The client needs the object component() returns, not a plain definition.
expectError(componentClient(built.definition));
