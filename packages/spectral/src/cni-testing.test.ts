import { connectionDefinitionConfigVar, flow, TriggerBaseResult, TriggerPayload } from ".";
import { convertConfigVar, convertFlow } from "./serverTypes/convertIntegration";
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

  const configVar = connectionDefinitionConfigVar({
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

describe("test convert flow", () => {
  describe("with onInstanceDeploy and onInstanceDelete behavior defined", () => {
    const baseTestFlowInput = {
      name: "Test Flow",
      stableKey: "my-test-flow",
      description: "This is a test flow, nothing special",
      onInstanceDeploy: async () => Promise.resolve({ executionState: { test: 123 } }),
      onInstanceDelete: async () => Promise.resolve({ executionState: { test: 456 } }),
      onExecution: async () => {
        return { data: 123 };
      },
    };

    const baseExpectedFlowOutput = {
      description: "This is a test flow, nothing special",
      name: "Test Flow",
      stableKey: "my-test-flow",
      steps: [
        {
          action: {
            component: {
              isPublic: false,
              key: "test-reference-key",
              version: "LATEST",
            },
            key: "testFlow_onTrigger",
          },
          description: "The function that will be executed by the flow to return an HTTP response.",
          isTrigger: true,
          name: "On Trigger",
          stableKey: "my-test-flow-onTrigger",
        },
        {
          action: {
            component: {
              isPublic: false,
              key: "test-reference-key",
              version: "LATEST",
            },
            key: "testFlow_onExecution",
          },
          description: "The function that will be executed by the flow.",
          name: "On Execution",
          stableKey: "my-test-flow-onExecution",
        },
      ],
      supplementalComponents: [],
    };

    it("creates a custom trigger component and returns the expected converted flow object", async () => {
      const testFlow = flow({
        ...baseTestFlowInput,
        onTrigger: async (context, payload, params) => {
          const result: TriggerBaseResult<TriggerPayload> = {
            payload,
          };

          result.response = {
            statusCode: 200,
            contentType: "application/json",
            body: JSON.stringify({ myTest: "abc" }),
          };

          return Promise.resolve(result);
        },
      });

      expect(convertFlow(testFlow, {}, "test-reference-key")).toMatchObject({
        ...baseExpectedFlowOutput,
        supplementalComponents: [],
      });
    });

    it("wraps default webhook trigger in a custom component and populates the supplemental components block", async () => {
      const testFlow = flow({
        ...baseTestFlowInput,
        onTrigger: undefined,
      });

      const supplementalComponents = [
        {
          isPublic: true,
          key: "webhook-triggers",
          version: "LATEST",
        },
      ];

      expect(convertFlow(testFlow, {}, "test-reference-key")).toMatchObject({
        ...baseExpectedFlowOutput,
        supplementalComponents,
      });
    });

    it("wraps default schedule trigger in a custom component and populates the supplemental components block", async () => {
      const testFlow = flow({
        ...baseTestFlowInput,
        schedule: {
          value: "20 10 * * *",
          timeZone: "America/Chicago",
        },
      });

      const supplementalComponents = [
        {
          isPublic: true,
          key: "schedule-triggers",
          version: "LATEST",
        },
      ];

      expect(convertFlow(testFlow, {}, "test-reference-key")).toMatchObject({
        ...baseExpectedFlowOutput,
        supplementalComponents,
      });
    });
  });
});
