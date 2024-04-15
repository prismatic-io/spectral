import { configPage, flow, reference } from ".";
import {
  connectionValue,
  defaultConnectionValueEnvironmentVariable,
  invokeFlow,
} from "./testing";

describe("default onTrigger", () => {
  const basicFlow = flow({
    name: "Basic Flow",
    stableKey: "basic-flow",
    description: "This is a basic flow",
    onExecution: async (context, params) => {
      return Promise.resolve({ data: params.onTrigger.results.body.data });
    },
  });

  it("basic example works", async () => {
    const { result } = await invokeFlow(basicFlow, {});
    expect(result).toMatchObject({ data: JSON.stringify({ foo: "bar" }) });
  });

  it("supports mocking trigger payload", async () => {
    const testPayload = { hello: "world" };
    const { result } = await invokeFlow(basicFlow, {
      payload: { body: { data: testPayload } },
    });
    expect(result).toMatchObject({ data: testPayload });
  });
});

describe("test flow using connections", () => {
  interface TestConnection {
    type: "connection";
    component: "test";
    key: "conn";
    values: {
      hello: string;
      world: string;
    };
  }
  type Components = TestConnection;

  const configPages = {
    Connections: configPage({
      elements: {
        "A Connection": reference<Components>().connection({
          stableKey: "a-connection",
          connection: {
            component: "test",
            key: "conn",
            values: {
              hello: { value: "world" },
              world: { value: "hello" },
            },
          },
        }),
      },
    }),
  };

  const connectionFlow = flow<typeof configPages, Components>({
    name: "Connection Flow",
    stableKey: "connection-flow",
    description: "This is a connection flow",
    onExecution: async (context) => {
      return Promise.resolve({ data: context.configVars });
    },
  });

  it("can supply connection mock value", async () => {
    const accessToken = "foobarbazzle";
    const value = {
      fields: {},
      token: { access_token: accessToken },
    };
    process.env[defaultConnectionValueEnvironmentVariable] =
      JSON.stringify(value);

    const { result } = await invokeFlow(connectionFlow, {
      configVars: {
        "A Connection": connectionValue(),
      },
    });
    expect(result).toMatchObject({ data: { "A Connection": value } });
  });
});
