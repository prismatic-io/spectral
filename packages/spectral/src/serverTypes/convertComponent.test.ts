import { describe, expect, it } from "vitest";
import { connection, dynamicObjectInput, input, structuredObjectInput } from "..";
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

  it("converts a dynamicObject input with configurations and nested children", () => {
    const data = dynamicObjectInput({
      label: "Record Data",
      required: true,
      configurations: {
        contact: {
          label: "Contact",
          comments: "Create a new contact",
          inputs: {
            name: structuredObjectInput({
              label: "Name",
              inputs: {
                first: input({ type: "string", label: "First Name", required: true }),
                last: input({ type: "string", label: "Last Name", required: true }),
              },
            }),
            email: input({ type: "string", label: "Email", required: true }),
          },
        },
        account: {
          label: "Account",
          comments: "Create a new account",
          inputs: {
            companyName: input({ type: "string", label: "Company Name", required: true }),
          },
        },
      },
    });

    const converted = convertInput("data", data);

    expect(converted.key).toBe("data");
    expect(converted.type).toBe("dynamicObject");
    expect(converted.required).toBe(true);
    expect(converted.inputs).toHaveLength(2);

    const contact = converted.inputs?.find((c) => c.key === "contact");
    expect(contact).toMatchObject({
      key: "contact",
      type: "structuredObject",
      label: "Contact",
      comments: "Create a new contact",
    });
    expect(contact?.inputs).toHaveLength(2);
    const contactName = contact?.inputs?.find((i) => i.key === "name");
    expect(contactName).toMatchObject({ key: "name", type: "structuredObject" });
    expect(contactName?.inputs).toHaveLength(2);
    expect(contactName?.inputs?.[0]).toMatchObject({
      key: "first",
      type: "string",
      required: true,
    });

    const account = converted.inputs?.find((c) => c.key === "account");
    expect(account).toMatchObject({
      key: "account",
      type: "structuredObject",
      label: "Account",
      comments: "Create a new account",
    });
    expect(account?.inputs).toHaveLength(1);
    expect(account?.inputs?.[0]).toMatchObject({
      key: "companyName",
      type: "string",
      required: true,
    });
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
