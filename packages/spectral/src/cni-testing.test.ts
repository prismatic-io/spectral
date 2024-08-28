import { connectionConfigVar, flow } from ".";
import { convertConfigVar } from "./serverTypes/convertIntegration";
import { connectionValue, defaultConnectionValueEnvironmentVariable, invokeFlow } from "./testing";

// TODO: This changeset it questionable.
// We were only using configPages for the types which we no longer need.
// It seems fine to remove but not sure.
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
  const connectionFlow = flow({
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
    process.env[defaultConnectionValueEnvironmentVariable] = JSON.stringify(value);

    const { result } = await invokeFlow(connectionFlow, {
      configVars: {
        "A Connection": connectionValue(),
      },
    });
    expect(result).toMatchObject({ data: { "A Connection": value } });
  });
});

describe("test input conversion", () => {
  const defaultKeyValuePairs = [
    { key: "defaultKey1", value: "my first default value" },
    { key: "defaultKey2", value: "my second default value" },
  ];
  const defaultValues = ["string 1", "string 2"];

  const configVar = connectionConfigVar({
    stableKey: "my-test-connection",
    dataType: "connection",
    inputs: {
      "My Key Value List": {
        label: "This is a collection of key-value pairs.",
        type: "string",
        collection: "keyvaluelist",
        default: defaultKeyValuePairs,
      },
      "My Regular Value List": {
        label: "This is a collection of strings.",
        type: "string",
        collection: "valuelist",
        default: defaultValues,
      },
    },
  });

  it("converts default keyvaluelist & valuelist config var definitions into the correct shape", async () => {
    const convertedConfigVar = convertConfigVar(
      "my-config-var",
      configVar,
      "fake-component-reference-key",
      {},
    );

    expect(convertedConfigVar.inputs).toMatchObject({
      "My Key Value List": {
        type: "complex",
        value: [
          {
            name: defaultKeyValuePairs[0].key,
            type: "value",
            value: defaultKeyValuePairs[0].value,
          },
          {
            name: defaultKeyValuePairs[1].key,
            type: "value",
            value: defaultKeyValuePairs[1].value,
          },
        ],
        meta: {
          orgOnly: false,
          visibleToCustomerDeployer: true,
          visibleToOrgDeployer: true,
        },
      },
      "My Regular Value List": {
        type: "complex",
        value: [
          {
            type: "value",
            value: defaultValues[0],
          },
          {
            type: "value",
            value: defaultValues[1],
          },
        ],
        meta: {
          orgOnly: false,
          visibleToCustomerDeployer: true,
          visibleToOrgDeployer: true,
        },
      },
    });
  });
});
