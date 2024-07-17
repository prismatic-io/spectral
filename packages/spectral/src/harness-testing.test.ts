import { createHarness, ComponentTestHarness } from "./testing";
import { component, connection, input, action, trigger, dataSource } from ".";
import { ConnectionValue } from "./serverTypes";
import { OAuth2Type } from "./types";
import util from "./util";

const testConnection = connection({
  key: "connection",
  label: "Test Connection",
  oauth2Type: OAuth2Type.AuthorizationCode,
  inputs: {
    authorizeUrl: {
      label: "Authorize URL",
      placeholder: "Authorize URL",
      type: "string",
      required: true,
      shown: false,
      default: "https://example.com/auth",
      comments: "The OAuth 2.0 Authorization URL for the API",
    },
    tokenUrl: {
      label: "Token URL",
      placeholder: "Token URL",
      type: "string",
      required: true,
      shown: false,
      default: "https://example.com/token",
      comments: "The OAuth 2.0 Token URL for the API",
    },
    scopes: {
      label: "Scopes",
      placeholder: "Scopes",
      type: "string",
      required: true,
      shown: true,
      comments: "Space separated OAuth 2.0 permission scopes for the API",
      default: "offline_access",
    },
    clientId: {
      label: "Client ID",
      placeholder: "Client ID",
      type: "string",
      required: true,
      shown: true,
      default: "client-id",
      comments: "Client Identifier of your app for the API",
    },
    clientSecret: {
      label: "Client Secret",
      placeholder: "Client Secret",
      type: "password",
      required: true,
      shown: true,
      default: "client-secret",
      comments: "Client Secret of your app for the API",
    },
  },
});

const connectionValue: ConnectionValue = {
  key: testConnection.key,
  configVarKey: "testConnection",
  fields: Object.entries(testConnection.inputs).reduce<Record<string, unknown>>(
    (result, [key, { default: value }]) => ({ ...result, [key]: value }),
    {},
  ),
  token: {
    access_token: "access",
    refresh_token: "refresh",
    expires_in: 100,
    scope: "offline_access",
    token_type: "Bearer",
  },
};
process.env.PRISMATIC_CONNECTION_VALUE = JSON.stringify(connectionValue);

const connectionInput = input({
  label: "Connection",
  type: "connection",
});

const fooInput = input({
  label: "Foo",
  type: "string",
});

const cleanInput = input({
  label: "Clean",
  type: "string",
  clean: (value) => util.types.toNumber(value),
});

const DEFAULTED_VALUE = 5;
const defaultedInput = input({
  label: "Defaulted",
  type: "string",
  required: false,
  default: DEFAULTED_VALUE.toString(),
});

const defaultedCleanInput = input({
  label: "Defaulted Clean",
  type: "string",
  required: false,
  default: DEFAULTED_VALUE.toString(),
  clean: (value) => (util.types.isInt(value) ? value : DEFAULTED_VALUE),
});

const fooAction = action({
  display: {
    label: "Foo",
    description: "Foo",
  },
  inputs: { connectionInput, fooInput },
  perform: async (context, params) => {
    return Promise.resolve({ data: params });
  },
});

const cleanAction = action({
  display: { label: "Clean", description: "Clean" },
  inputs: { cleanInput },
  perform: async (context, params) => {
    return Promise.resolve({ data: params });
  },
});

const cleanDefaultedAction = action({
  display: {
    label: "Clean Defaulted Action",
    description: "Clean Defaulted Action",
  },
  inputs: { defaultedInput, defaultedCleanInput },
  perform: async (context, params) => {
    return Promise.resolve({ data: params });
  },
});

const fooTrigger = trigger({
  display: {
    label: "Foo",
    description: "Foo",
  },
  inputs: { connectionInput },
  perform: async (context, payload, params) => {
    return Promise.resolve({ payload, params });
  },
  scheduleSupport: "invalid",
  synchronousResponseSupport: "invalid",
});

const cleanTrigger = trigger({
  display: {
    label: "Clean",
    description: "Clean",
  },
  inputs: { connectionInput, cleanInput },
  perform: async (context, payload, params) => {
    return Promise.resolve({ payload, params });
  },
  scheduleSupport: "invalid",
  synchronousResponseSupport: "invalid",
});

const fooDataSource = dataSource({
  display: {
    label: "Foo",
    description: "Foo",
  },
  inputs: { connectionInput, fooInput },
  perform: async (context, { fooInput }) => {
    return Promise.resolve({ result: `${fooInput}` });
  },
  dataSourceType: "string",
});

const cleanDataSource = dataSource({
  display: {
    label: "Clean",
    description: "clean",
  },
  inputs: { connectionInput, cleanInput },
  perform: async (context, { cleanInput }) => {
    return Promise.resolve({ result: cleanInput });
  },
  dataSourceType: "number",
});

const sample = component({
  key: "sample",
  display: {
    label: "Sample",
    description: "Sample",
    iconPath: "icon.png",
  },
  triggers: { fooTrigger, cleanTrigger },
  actions: { fooAction, cleanAction, cleanDefaultedAction },
  dataSources: { fooDataSource, cleanDataSource },
  connections: [testConnection],
});

describe("harness", () => {
  it("wraps a component", () => {
    const harness = createHarness(sample);
    expect(harness).toBeInstanceOf(ComponentTestHarness);
  });
});

describe("invoking", () => {
  const harness = createHarness(sample);

  it("should allow invoking a trigger", async () => {
    const result = await harness.trigger("fooTrigger", undefined, {
      connectionInput: harness.connectionValue(testConnection),
    });
    expect(result?.payload).toBeDefined();
    expect(result).toMatchObject({
      params: { connectionInput: connectionValue },
    });
  });

  it("should allow invoking an action", async () => {
    const result = await harness.action("fooAction", {
      connectionInput: harness.connectionValue(testConnection),
      fooInput: "hello",
    });
    expect(result?.data).toMatchObject({ fooInput: "hello" });
  });

  it("should allow invoking a datasource", async () => {
    const result = await harness.dataSource("fooDataSource", {
      connectionInput: harness.connectionValue(testConnection),
      fooInput: "hello",
    });
    expect(result?.result).toBe("hello");
  });
});

describe("clean inputs", () => {
  const harness = createHarness(sample);

  it("should clean action inputs", async () => {
    const result = await harness.action("cleanAction", {
      cleanInput: "200",
    });
    expect(result?.data).toMatchObject({ cleanInput: 200 });
  });

  it("should clean trigger inputs", async () => {
    const result = await harness.trigger("cleanTrigger", undefined, {
      connectionInput: harness.connectionValue(testConnection),
      cleanInput: "200",
    });
    expect(result?.payload).toBeDefined();
    expect(result).toMatchObject({
      params: { connectionInput: connectionValue, cleanInput: 200 },
    });
  });
});

describe("defaulting inputs", () => {
  const harness = createHarness(sample);

  it("should support defaulted inputs", async () => {
    const result = await harness.action("cleanDefaultedAction");
    expect(result?.data).toMatchObject({
      defaultedInput: DEFAULTED_VALUE.toString(),
      defaultedCleanInput: DEFAULTED_VALUE,
    });
  });

  it("should support defaulted cleaned inputs", async () => {
    const expected = 1000;
    const result = await harness.action("cleanDefaultedAction", {
      defaultedCleanInput: expected,
    });
    expect(result?.data).toMatchObject({
      defaultedInput: DEFAULTED_VALUE.toString(),
      defaultedCleanInput: expected,
    });
  });
});
