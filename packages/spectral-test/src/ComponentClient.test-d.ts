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
import { expectError, expectType } from "tsd";

const platformComponent = component({
  key: "typed-client",
  public: false,
  display: { label: "Typed client", description: "Typed client", iconPath: "icon.png" },
  actions: {
    create: action({
      display: { label: "Create", description: "Create" },
      inputs: {
        name: input({
          label: "Name",
          type: "string",
          required: true,
          clean: util.types.toString,
        }),
        count: input({
          label: "Count",
          type: "number",
          default: "1",
        }),
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
      inputs: {
        secret: input({ label: "Secret", type: "string", required: true }),
      },
      scheduleSupport: "invalid",
      synchronousResponseSupport: "valid",
      perform: async (_context, payload) => ({ payload }),
    }),
  },
  dataSources: {
    projects: dataSource({
      display: { label: "Projects", description: "Projects" },
      inputs: {
        connection: input({ label: "Connection", type: "connection", required: true }),
      },
      dataSourceType: "picklist",
      perform: async () => ({ result: [] }),
    }),
  },
  connections: [
    connection({
      key: "apiKey",
      display: { label: "API key", description: "API key" },
      inputs: {
        token: input({ label: "Token", type: "password", required: true }),
      },
    }),
  ],
});

const client = componentClient<typeof platformComponent.definition>({
  key: "typed-client",
  public: false,
  actions: { create: { inputs: {} }, ping: { inputs: {} } },
  triggers: { webhook: { inputs: {} } },
  dataSources: { projects: { inputs: {}, dataSourceType: "picklist" } },
  connections: [{ key: "apiKey", inputs: {} }],
});

expectType<Promise<{ data: { name: string; count: number } }>>(
  client.actions.create({ name: "Ada" }),
);
expectType<Promise<{ data: "pong" }>>(client.actions.ping());
expectError(client.actions.create({}));
expectError(client.actions.create({ name: "Ada", unknown: true }));
expectError(client.actions.missing);
expectType<"trigger">(client.triggers.webhook().kind);
expectError(client.triggers.webhook({ missing: { value: "nope" } }));
expectType<"dataSource">(client.dataSources.projects({ stableKey: "projects" }).dataSource.kind);
expectError(client.dataSources.missing);
expectType<"connection">(client.connections.apiKey({ stableKey: "api-key" }).connection.kind);
expectError(client.connections.missing);

// The built component carries its definition, and the definition's types are the client's.
expectType<"typed-client">(platformComponent.definition.key);
const inferredClient = componentClient(platformComponent.definition);
expectType<Promise<{ data: "pong" }>>(inferredClient.actions.ping());
expectError(inferredClient.actions.create({}));
