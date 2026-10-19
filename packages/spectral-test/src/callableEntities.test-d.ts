import {
  action,
  batchTrigger,
  type ConnectionConfigVar,
  callableComponent,
  component,
  connection,
  type DataSourceResult,
  dataSource,
  dataSourceConfigVar,
  flow,
  input,
  OAuth2Type,
  oauth2Connection,
  onPremConnection,
  pollingTrigger,
  type TriggerDefinition,
  type TriggerPayload,
  trigger,
} from "@prismatic-io/spectral";
import { expectError, expectType } from "tsd";

const display = { label: "Entity", description: "Entity" };
const payload = {} as TriggerPayload;
const query = input({
  type: "string",
  label: "Query",
  required: true,
  clean: (value: unknown) => ({ parsed: String(value) }),
});
const api = connection({
  key: "api",
  display,
  inputs: { token: input({ type: "password", label: "Token", required: true }) },
});
expectType<"api">(api.key);
const directConnection = callableComponent({ connections: [api] });
expectType<"api">({} as keyof typeof directConnection.connections);
const standaloneDataSource = dataSource({
  display,
  dataSourceType: "picklist",
  inputs: { query },
  perform: async (_context, params) => ({ result: [params.query.parsed] }),
});
expectType<"picklist">(standaloneDataSource.dataSourceType);
const callable = callableComponent(
  component({
    key: "entities",
    display: { ...display, iconPath: "icon.png" },
    dataSources: {
      choices: dataSource({
        display,
        dataSourceType: "picklist",
        inputs: { query },
        perform: async (_context, params) => ({ result: [params.query.parsed] }),
      }),
    },
    triggers: {
      webhook: trigger({
        display,
        inputs: { query },
        scheduleSupport: "invalid",
        synchronousResponseSupport: "valid",
        perform: async (_context, payload, params) => ({
          payload,
          instanceState: { query: params.query.parsed },
        }),
        onInstanceDeploy: async (_context, params) => ({
          instanceState: { query: params.query.parsed },
        }),
        webhookLifecycleHandlers: {
          create: async () => ({}),
          delete: async () => ({}),
        },
      }),
      poll: pollingTrigger({
        display,
        inputs: { watermark: input({ type: "string", label: "Watermark", required: true }) },
        pollAction: action({ display, inputs: { query }, perform: async () => ({ data: 1 }) }),
        perform: async (_context, payload) => ({ payload }),
      }),
      batch: batchTrigger({
        display,
        inputs: { query },
        scheduleSupport: "valid",
        batchConfig: { batchSize: 1 },
        perform: async () => ({ items: ["item"] }),
        onDeploy: {
          inputs: { start: input({ type: "number", label: "Start", required: true }) },
          perform: async () => ({ items: ["initial"] }),
        },
      }),
    },
    connections: [api],
  }),
);

expectType<"choices">({} as keyof typeof callable.dataSources);
expectType<Promise<DataSourceResult<"picklist">>>(callable.dataSources.choices({ query: "raw" }));
expectError(callable.dataSources.choices());
expectError(callable.dataSources.choices({ query: { parsed: "raw" } }));
expectError(callable.dataSources.unknown());
expectType<"webhook" | "poll" | "batch">({} as keyof typeof callable.triggers);
expectType<Promise<{ payload: TriggerPayload; instanceState: { query: string } }>>(
  callable.triggers.webhook.perform(payload, { query: "raw" }),
);
expectError(callable.triggers.webhook.perform(payload));
expectError(callable.triggers.webhook.perform(payload, { query: { parsed: "raw" } }));

flow({
  name: "Bundled webhook",
  stableKey: "bundled-webhook",
  onTrigger: callable.triggers.webhook({ query: { configVar: "Query" } }),
  onExecution: async () => ({ data: true }),
});
callable.triggers.webhook({ query: "raw" });
callable.triggers.webhook({ query: { value: "raw" } });
expectError(callable.triggers.webhook());
expectError(callable.triggers.webhook({ query: { parsed: "raw" } }));
expectError(callable.triggers.webhook({ query: { value: { parsed: "raw" } } }));
expectError(callable.triggers.webhook({ query: { configVar: 3 } }));
expectError(callable.triggers.webhook({ missing: "raw" }));
flow({
  name: "Bundled polling",
  stableKey: "bundled-polling",
  schedule: { value: "*/5 * * * *" },
  onTrigger: callable.triggers.poll({ query: "raw", watermark: { configVar: "Cursor" } }),
  onExecution: async () => ({ data: true }),
});
expectError(callable.triggers.poll({ query: "raw" }));
callable.triggers.batch({ query: "raw", start: { value: 1 } });
expectError(callable.triggers.batch({ query: "raw" }));

if (callable.triggers.webhook.onInstanceDeploy) {
  expectType<ReturnType<NonNullable<TriggerDefinition["onInstanceDeploy"]>>>(
    callable.triggers.webhook.onInstanceDeploy({ query: "raw" }),
  );
  expectError(callable.triggers.webhook.onInstanceDeploy());
  expectError(callable.triggers.webhook.onInstanceDeploy({ query: { parsed: "raw" } }));
}
if (callable.triggers.webhook.webhookLifecycleHandlers) {
  expectType<ReturnType<NonNullable<TriggerDefinition["onInstanceDeploy"]>>>(
    callable.triggers.webhook.webhookLifecycleHandlers.create({ query: "raw" }),
  );
  callable.triggers.webhook.webhookLifecycleHandlers.delete({ query: "raw" });
  expectError(callable.triggers.webhook.webhookLifecycleHandlers.create());
}

callable.triggers.poll.perform(payload, { query: "raw", watermark: "cursor" });
expectError(callable.triggers.poll.perform(payload, { watermark: "cursor" }));
expectError(callable.triggers.poll.perform(payload, { query: "raw" }));
expectError(
  callable.triggers.poll.perform(payload, { query: { parsed: "raw" }, watermark: "cursor" }),
);
callable.triggers.batch.perform(payload, { query: "raw" });
expectError(callable.triggers.batch.perform(payload, { query: "raw", start: 1 }));
if (callable.triggers.batch.onDeployPerform) {
  callable.triggers.batch.onDeployPerform(payload, { query: "raw", start: 1 });
  expectError(callable.triggers.batch.onDeployPerform(payload, { query: "raw" }));
  expectError(callable.triggers.batch.onDeployPerform(payload, { start: 1 }));
}
if (callable.triggers.batch.triggerResolver?.resolveItems) {
  expectType<unknown[]>(callable.triggers.batch.triggerResolver.resolveItems({ payload }));
  expectError(callable.triggers.batch.triggerResolver.resolveItems({}, { payload }));
}

expectType<"api">({} as keyof typeof callable.connections);
expectError(callable.connections.missing);
expectType<ConnectionConfigVar>(
  callable.connections.api({
    stableKey: "api-config",
    values: { token: { value: "raw" } },
  }),
);
expectError(callable.connections.api({ stableKey: "api", version: 2 }));
expectError(callable.connections.api({ stableKey: "api", version: "LATEST" }));
const versionedConnectionOptions = { stableKey: "api", version: 2 };
expectError(callable.connections.api(versionedConnectionOptions));
expectError(callable.connections.api({}));
expectError(callable.connections.api({ stableKey: "api", values: { missing: { value: "raw" } } }));
expectError(callable.connections.api({ stableKey: "api", values: { token: { value: 123 } } }));
const choicesConfig = callable.dataSources.choices({
  stableKey: "choices",
  values: { query: { configVar: "Query" } },
  defaultValue: "one",
});
dataSourceConfigVar(choicesConfig);
expectType<"picklist">(choicesConfig.dataSourceType);
expectError(callable.dataSources.choices({ stableKey: "choices", values: {} }));
expectError(
  callable.dataSources.choices({ stableKey: "choices", values: { query: { parsed: "cleaned" } } }),
);
expectType<Promise<DataSourceResult<"picklist">>>(
  callable.dataSources.choices.perform({ query: "raw" }),
);

const noEntities = callableComponent(
  component({ key: "empty", display: { ...display, iconPath: "icon.png" } }),
);
expectType<never>({} as keyof typeof noEntities.actions);
expectType<never>({} as keyof typeof noEntities.triggers);
expectType<never>({} as keyof typeof noEntities.dataSources);
expectType<never>({} as keyof typeof noEntities.connections);

const mutableApi = connection({
  key: "mutableApi",
  display: { label: "Before", description: "Before" },
  inputs: { token: { type: "password", label: "Token", default: "before" } },
});
mutableApi.display.label = "After";
mutableApi.inputs.token.default = "after";
mutableApi.inputs.token = { type: "password", label: "Updated", default: "updated" };
expectType<"mutableApi">(mutableApi.key);

const mutableOnPrem = onPremConnection({
  key: "mutableOnPrem",
  display: { label: "Before", description: "Before" },
  inputs: {
    host: { type: "string", label: "Host", onPremControlled: true, default: "before" },
    port: { type: "string", label: "Port", onPremControlled: true, default: "5432" },
  },
});
mutableOnPrem.display.label = "After";
mutableOnPrem.inputs.host.default = "after";
expectType<"mutableOnPrem">(mutableOnPrem.key);

const mutableOAuth = oauth2Connection({
  key: "mutableOAuth",
  display: { label: "Before", description: "Before" },
  oauth2Type: OAuth2Type.ClientCredentials,
  inputs: {
    tokenUrl: { type: "string", label: "Token URL", default: "https://before.example/token" },
    scopes: { type: "string", label: "Scopes" },
    clientId: { type: "string", label: "Client ID" },
    clientSecret: { type: "password", label: "Client secret" },
  },
});
mutableOAuth.display.label = "After";
mutableOAuth.inputs.tokenUrl.default = "https://after.example/token";
expectType<"mutableOAuth">(mutableOAuth.key);
