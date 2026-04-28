import { describe, expect, it } from "vitest";
import { connection, input, trigger } from "..";
import {
  convertConnection,
  convertInput,
  convertTemplateInput,
  convertTrigger,
} from "./convertComponent";

describe("convertConnection", () => {
  const label = "My Basic Connection";
  const description = "This is a basic connection.";

  const basicConnection = connection({
    key: "my-basic-connection",
    display: {
      label,
      description,
    },
    inputs: {},
  });

  it("correctly converts the display block", async () => {
    const convertedConnection = convertConnection(basicConnection);
    expect(convertedConnection.label).toBe(label);
    expect(convertedConnection.comments).toBe(description);
  });
});

describe("convertInput", () => {
  const dataSourceKey = "string-data-source";
  const basicInputWithDataSource = input({
    label: "Basic Input",
    type: "string",
    default: "Default String Input",
    dataSource: dataSourceKey,
  });

  it("correctly converts an input data source", () => {
    const basicInputWithDataSourceKey = "basicInputWithDataSource";
    const convertedInput = convertInput(basicInputWithDataSourceKey, basicInputWithDataSource);

    expect(convertedInput.key).toBe(basicInputWithDataSourceKey);
    expect(convertedInput.dataSource).toBe(dataSourceKey);
  });
});

describe("convertTemplateInput", () => {
  it("correctly handles valid template input values", () => {
    expect(
      convertTemplateInput(
        "authUrl",
        input({
          type: "template",
          label: "authUrl",
          templateValue: "https://{{#domain}}.something.com/{{#path}}",
        }),
        {
          domain: input({
            type: "string",
            label: "Domain",
          }),
          path: input({
            type: "string",
            label: "path",
          }),
        },
      ),
    ).toMatchObject({
      key: "authUrl",
      type: "template",
      default: "https://{{#domain}}.something.com/{{#path}}",
      label: "authUrl",
      shown: false,
    });
  });

  it.each([
    [
      "missing input key",
      {
        key: "authUrl",
        templateInput: input({
          type: "template",
          label: "authUrl",
          templateValue: "https://{{#domain}}.something.com/{{#path}}",
        }),
        inputs: {
          domain: input({
            type: "string",
            label: "Domain",
          }),
        },
        expected: `Template input "authUrl": Invalid keys were found in the template string. All referenced keys must be non-template inputs declared in the first argument: path`,
      },
    ],
    [
      "invalid input key",
      {
        key: "authUrl",
        templateInput: input({
          type: "template",
          label: "authUrl",
          templateValue: "https://{{#subdomain}}.something.com/",
        }),
        inputs: {
          domain: input({
            type: "string",
            label: "Domain",
          }),
        },
        expected: `Template input "authUrl": Invalid keys were found in the template string. All referenced keys must be non-template inputs declared in the first argument: subdomain`,
      },
    ],
    [
      "does not accept other template values",
      {
        key: "authUrl",
        templateInput: input({
          type: "template",
          label: "authUrl",
          templateValue: "https://{{#domain}}.something.com/",
        }),
        inputs: {
          domain: input({
            type: "template",
            label: "Domain",
            templateValue: "{{#nestedKey}}",
          }),
        },
        expected: `Template input "authUrl": Invalid keys were found in the template string. All referenced keys must be non-template inputs declared in the first argument: domain`,
      },
    ],
  ])("correctly handles valid template input values: %s", (_scenario, {
    key,
    templateInput,
    inputs,
    expected,
  }) => {
    expect(() => convertTemplateInput(key, templateInput, inputs)).toThrow(expected);
  });
});

const baseTrigger = {
  display: { label: "My Trigger", description: "" },
  perform: async () => ({ payload: { body: { data: "" }, headers: {} } }),
  inputs: {},
  scheduleSupport: "invalid" as const,
  synchronousResponseSupport: "invalid" as const,
};

describe("convertTrigger triggerResolver", () => {
  it("defaults triggerResolverSupport to 'valid' when triggerResolver is declared without explicit support", () => {
    const result = convertTrigger(
      "myTrigger",
      trigger({
        ...baseTrigger,
        triggerResolver: { default: { batchSize: 50 } },
      }),
    );
    expect(result.triggerResolverSupport).toBe("valid");
    expect(result.triggerResolverDefaultBatchSize).toBe(50);
  });

  it("defaults triggerResolverSupport to 'invalid' when no triggerResolver is declared", () => {
    const result = convertTrigger("myTrigger", trigger(baseTrigger));
    expect(result.triggerResolverSupport).toBe("invalid");
    expect(result.triggerResolverDefaultBatchSize).toBeUndefined();
    expect(result.hasResolveTriggerItems).toBeUndefined();
  });

  it("emits default batchSize 1 when triggerResolverSupport is 'valid' without a triggerResolver", () => {
    const result = convertTrigger(
      "myTrigger",
      trigger({
        ...baseTrigger,
        triggerResolverSupport: "valid",
      }),
    );
    expect(result.triggerResolverSupport).toBe("valid");
    expect(result.triggerResolverDefaultBatchSize).toBe(1);
  });

  it("rejects triggerResolverSupport='required' without triggerResolver", () => {
    expect(() =>
      convertTrigger(
        "myTrigger",
        trigger({
          ...baseTrigger,
          triggerResolverSupport: "required",
        }),
      ),
    ).toThrow(/triggerResolverSupport "required" but is missing triggerResolver/);
  });

  it("rejects triggerResolverSupport='invalid' when triggerResolver is set", () => {
    expect(() =>
      convertTrigger(
        "myTrigger",
        trigger({
          ...baseTrigger,
          triggerResolverSupport: "invalid",
          triggerResolver: { default: { batchSize: 50 } },
        }),
      ),
    ).toThrow(/triggerResolver but triggerResolverSupport is "invalid"/);
  });

  it("rejects triggerResolver with batchSize < 1", () => {
    expect(() =>
      convertTrigger(
        "myTrigger",
        trigger({
          ...baseTrigger,
          triggerResolver: { default: { batchSize: 0 } },
        }),
      ),
    ).toThrow(/invalid triggerResolver\.default batchSize of 0/);
  });

  it("preserves resolveItems on triggerResolver", () => {
    const result = convertTrigger(
      "myTrigger",
      trigger({
        ...baseTrigger,
        triggerResolver: {
          default: { batchSize: 25 },
          resolveItems: () => [1, 2, 3],
        },
      }),
    );
    expect(result.hasResolveTriggerItems).toBe(true);
    expect(result.triggerResolverDefaultBatchSize).toBe(25);
    expect(typeof result.resolveTriggerItems).toBe("function");
  });
});
