import { createHarness, ComponentTestHarness } from "./testing";
import { component, connection, input, action, trigger } from ".";
import { ConnectionValue } from "./serverTypes";
import { OAuth2Type } from "./types";

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
    {}
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

const sample = component({
  key: "sample",
  display: {
    label: "Sample",
    description: "Sample",
    iconPath: "icon.png",
  },
  triggers: { fooTrigger },
  actions: { fooAction },
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
});
