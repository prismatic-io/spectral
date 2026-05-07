import { describe, expect, it } from "vitest";
import { connection, input, structuredObjectInput } from "..";
import { convertConnection, convertInput, convertTemplateInput } from "./convertComponent";

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

  it("converts a structuredObject input with nested children", () => {
    const name = structuredObjectInput({
      label: "Name",
      inputs: {
        first: input({ type: "string", label: "First Name", required: true }),
        last: input({ type: "string", label: "Last Name", required: true }),
        prefix: input({ type: "string", label: "Prefix" }),
      },
    });

    const converted = convertInput("name", name);

    expect(converted.key).toBe("name");
    expect(converted.type).toBe("structuredObject");
    expect(converted.inputs).toHaveLength(3);
    expect(converted.inputs?.[0]).toMatchObject({
      key: "first",
      type: "string",
      label: "First Name",
      required: true,
    });
    expect(converted.inputs?.[2]).toMatchObject({
      key: "prefix",
      type: "string",
      label: "Prefix",
    });
  });

  it("does not emit `inputs` on a non-structuredObject input", () => {
    const basicInput = input({ type: "string", label: "Basic" });
    const converted = convertInput("basic", basicInput);
    expect(converted.inputs).toBeUndefined();
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
