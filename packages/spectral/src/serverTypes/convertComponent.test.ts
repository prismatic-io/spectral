import { describe, expect, it, vi } from "vitest";
import { connection, dynamicObjectInput, input, structuredObjectInput, trigger } from "..";
import {
  cleanerFor,
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

describe("cleanerFor", () => {
  it("returns the declared clean function for a leaf input", () => {
    const cleaner = cleanerFor(input({ type: "string", label: "Age", clean: (v) => Number(v) }));
    expect(cleaner?.("42")).toBe(42);
  });

  it("returns undefined for a leaf input with no clean function", () => {
    expect(cleanerFor(input({ type: "string", label: "Name" }))).toBeUndefined();
  });

  describe("structuredObject", () => {
    it("invokes each child's clean function", () => {
      const firstClean = vi.fn((v: unknown) => `first:${v}`);
      const lastClean = vi.fn((v: unknown) => `last:${v}`);

      const cleaner = cleanerFor(
        structuredObjectInput({
          label: "Name",
          inputs: {
            first: input({ type: "string", label: "First", clean: firstClean }),
            last: input({ type: "string", label: "Last", clean: lastClean }),
          },
        }),
      );

      expect(cleaner).toBeDefined();
      expect(cleaner?.({ first: "Bob", last: "Smith" })).toStrictEqual({
        first: "first:Bob",
        last: "last:Smith",
      });
      expect(firstClean).toHaveBeenCalledWith("Bob");
      expect(lastClean).toHaveBeenCalledWith("Smith");
    });

    it("leaves children without a clean function untouched", () => {
      const cleaner = cleanerFor(
        structuredObjectInput({
          label: "Mixed",
          inputs: {
            cleaned: input({ type: "string", label: "Cleaned", clean: (v) => `!${v}` }),
            raw: input({ type: "string", label: "Raw" }),
          },
        }),
      );

      expect(cleaner?.({ cleaned: "a", raw: "b" })).toStrictEqual({
        cleaned: "!a",
        raw: "b",
      });
    });

    it("always exists on conversion even when no child declares clean", () => {
      const cleaner = cleanerFor(
        structuredObjectInput({
          label: "Plain",
          inputs: {
            a: input({ type: "string", label: "A" }),
            b: input({ type: "string", label: "B" }),
          },
        }),
      );

      expect(cleaner).toBeDefined();
      expect(cleaner?.({ a: "x", b: "y" })).toStrictEqual({ a: "x", b: "y" });
    });

    it("passes through non-object values unchanged", () => {
      const cleaner = cleanerFor(
        structuredObjectInput({
          label: "Name",
          inputs: { first: input({ type: "string", label: "First", clean: (v) => v }) },
        }),
      );

      expect(cleaner?.(undefined)).toBeUndefined();
      expect(cleaner?.(null)).toBeNull();
    });
  });

  describe("dynamicObject", () => {
    it("invokes each child's clean function for the selected configuration", () => {
      const emailClean = vi.fn((v: unknown) => `email:${v}`);
      const companyClean = vi.fn((v: unknown) => `co:${v}`);

      const cleaner = cleanerFor(
        dynamicObjectInput({
          label: "Record",
          configurations: {
            contact: {
              label: "Contact",
              inputs: {
                email: input({ type: "string", label: "Email", clean: emailClean }),
              },
            },
            account: {
              label: "Account",
              inputs: {
                companyName: input({ type: "string", label: "Company", clean: companyClean }),
              },
            },
          },
        }),
      );

      expect(cleaner).toBeDefined();
      expect(cleaner?.({ configuration: "contact", values: { email: "a@b.co" } })).toStrictEqual({
        configuration: "contact",
        values: { email: "email:a@b.co" },
      });
      expect(emailClean).toHaveBeenCalledWith("a@b.co");
      expect(companyClean).not.toHaveBeenCalled();
    });

    it("delegates to a nested structuredObject child's children", () => {
      const firstClean = vi.fn((v: unknown) => `first:${v}`);
      const lastClean = vi.fn((v: unknown) => `last:${v}`);

      const cleaner = cleanerFor(
        dynamicObjectInput({
          label: "Record",
          configurations: {
            contact: {
              label: "Contact",
              inputs: {
                name: structuredObjectInput({
                  label: "Name",
                  inputs: {
                    first: input({ type: "string", label: "First", clean: firstClean }),
                    last: input({ type: "string", label: "Last", clean: lastClean }),
                  },
                }),
                email: input({ type: "string", label: "Email" }),
              },
            },
          },
        }),
      );

      const result = cleaner?.({
        configuration: "contact",
        values: {
          name: { first: "Ada", last: "Lovelace" },
          email: "ada@example.com",
        },
      });

      expect(result).toStrictEqual({
        configuration: "contact",
        values: {
          name: { first: "first:Ada", last: "last:Lovelace" },
          email: "ada@example.com",
        },
      });
      expect(firstClean).toHaveBeenCalledWith("Ada");
      expect(lastClean).toHaveBeenCalledWith("Lovelace");
    });

    it("always exists on conversion even when no descendant declares clean", () => {
      const cleaner = cleanerFor(
        dynamicObjectInput({
          label: "Record",
          configurations: {
            contact: {
              label: "Contact",
              inputs: { email: input({ type: "string", label: "Email" }) },
            },
          },
        }),
      );

      expect(cleaner).toBeDefined();
      expect(cleaner?.({ configuration: "contact", values: { email: "a@b.co" } })).toStrictEqual({
        configuration: "contact",
        values: { email: "a@b.co" },
      });
    });

    it("passes through values for an unknown configuration", () => {
      const emailClean = vi.fn((v: unknown) => `email:${v}`);
      const cleaner = cleanerFor(
        dynamicObjectInput({
          label: "Record",
          configurations: {
            contact: {
              label: "Contact",
              inputs: { email: input({ type: "string", label: "Email", clean: emailClean }) },
            },
          },
        }),
      );

      expect(cleaner?.({ configuration: "mystery", values: { email: "a@b.co" } })).toStrictEqual({
        configuration: "mystery",
        values: { email: "a@b.co" },
      });
      expect(emailClean).not.toHaveBeenCalled();
    });

    it("passes through non-object values unchanged", () => {
      const cleaner = cleanerFor(
        dynamicObjectInput({
          label: "Record",
          configurations: {
            contact: {
              label: "Contact",
              inputs: { email: input({ type: "string", label: "Email", clean: (v) => v }) },
            },
          },
        }),
      );

      expect(cleaner?.(undefined)).toBeUndefined();
      expect(cleaner?.(null)).toBeNull();
    });
  });
});
