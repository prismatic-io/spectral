import { describe, expect, it } from "vitest";
import type { ServerTypeInput } from "./getInputs";
import { getInputs } from "./getInputs";

const baseInput = (
  overrides: Partial<ServerTypeInput> & { key: string; type: string },
): ServerTypeInput => ({ label: overrides.key, required: false, ...overrides }) as ServerTypeInput;

describe("getInputs — structuredObject", () => {
  it("emits an inline object type from declared children", () => {
    const [result] = getInputs({
      inputs: [
        baseInput({
          key: "person",
          type: "structuredObject",
          inputs: [
            baseInput({ key: "first", type: "string" }),
            baseInput({ key: "last", type: "string" }),
            baseInput({ key: "active", type: "boolean" }),
          ],
        }),
      ],
    });

    expect(result.valueType).toBe("{ first: string; last: string; active: boolean }");
  });

  it("quotes non-identifier child keys", () => {
    const [result] = getInputs({
      inputs: [
        baseInput({
          key: "record",
          type: "structuredObject",
          inputs: [
            baseInput({ key: "my-field", type: "string" }),
            baseInput({ key: "normal", type: "string" }),
          ],
        }),
      ],
    });

    expect(result.valueType).toBe('{ "my-field": string; normal: string }');
  });

  it("uses inline import() syntax for import-object leaf types (e.g. connection)", () => {
    const [result] = getInputs({
      inputs: [
        baseInput({
          key: "config",
          type: "structuredObject",
          inputs: [
            baseInput({ key: "conn", type: "connection" }),
            baseInput({ key: "name", type: "string" }),
          ],
        }),
      ],
    });

    expect(result.valueType).toBe(
      '{ conn: import("@prismatic-io/spectral/dist/types").Connection; name: string }',
    );
  });

  it("narrows leaf children that have a model to a literal union", () => {
    const [result] = getInputs({
      inputs: [
        baseInput({
          key: "config",
          type: "structuredObject",
          inputs: [
            baseInput({
              key: "color",
              type: "string",
              model: [
                { label: "Red", value: "red" },
                { label: "Blue", value: "blue" },
              ],
            } as unknown as ServerTypeInput),
          ],
        }),
      ],
    });

    expect(result.valueType).toBe("{ color: `red` | `blue` }");
  });

  it("wraps a valuelist string child as Array<string>", () => {
    const [result] = getInputs({
      inputs: [
        baseInput({
          key: "rec",
          type: "structuredObject",
          inputs: [
            baseInput({ key: "tags", type: "string", collection: "valuelist" }),
            baseInput({ key: "title", type: "string" }),
          ],
        }),
      ],
    });

    expect(result.valueType).toBe("{ tags: Array<string>; title: string }");
  });

  it("wraps a keyvaluelist string child as the record-or-pairs union", () => {
    const [result] = getInputs({
      inputs: [
        baseInput({
          key: "rec",
          type: "structuredObject",
          inputs: [baseInput({ key: "headers", type: "string", collection: "keyvaluelist" })],
        }),
      ],
    });

    expect(result.valueType).toBe(
      "{ headers: Record<string, string> | Array<{key: string, value: string}> }",
    );
  });

  it("wraps a valuelist import-object child as Array<import(...).Type>", () => {
    const [result] = getInputs({
      inputs: [
        baseInput({
          key: "rec",
          type: "structuredObject",
          inputs: [baseInput({ key: "conns", type: "connection", collection: "valuelist" })],
        }),
      ],
    });

    expect(result.valueType).toBe(
      '{ conns: Array<import("@prismatic-io/spectral/dist/types").Connection> }',
    );
  });

  it("falls back to StructuredObject import when inputs are empty", () => {
    const [result] = getInputs({
      inputs: [baseInput({ key: "empty", type: "structuredObject", inputs: [] })],
    });

    expect(result.valueType).toBe('import("@prismatic-io/spectral/dist/types").StructuredObject');
  });
});

describe("getInputs — dynamicObject", () => {
  it("emits a discriminated union from configurations", () => {
    const [result] = getInputs({
      inputs: [
        baseInput({
          key: "record",
          type: "dynamicObject",
          inputs: [
            baseInput({
              key: "contact",
              type: "structuredObject",
              inputs: [
                baseInput({ key: "firstName", type: "string" }),
                baseInput({ key: "lastName", type: "string" }),
              ],
            }),
            baseInput({
              key: "account",
              type: "structuredObject",
              inputs: [baseInput({ key: "companyName", type: "string" })],
            }),
          ],
        }),
      ],
    });

    expect(result.valueType).toBe(
      '{ configuration: "contact"; values: { firstName: string; lastName: string } } | { configuration: "account"; values: { companyName: string } }',
    );
  });

  it("handles a configuration whose inputs include a structuredObject child", () => {
    const [result] = getInputs({
      inputs: [
        baseInput({
          key: "record",
          type: "dynamicObject",
          inputs: [
            baseInput({
              key: "contact",
              type: "structuredObject",
              inputs: [
                baseInput({
                  key: "name",
                  type: "structuredObject",
                  inputs: [
                    baseInput({ key: "first", type: "string" }),
                    baseInput({ key: "last", type: "string" }),
                  ],
                }),
                baseInput({ key: "email", type: "string" }),
              ],
            }),
          ],
        }),
      ],
    });

    expect(result.valueType).toBe(
      '{ configuration: "contact"; values: { name: { first: string; last: string }; email: string } }',
    );
  });

  it("uses StructuredObject import for a configuration with no inputs", () => {
    const [result] = getInputs({
      inputs: [
        baseInput({
          key: "record",
          type: "dynamicObject",
          inputs: [
            baseInput({ key: "empty", type: "structuredObject", inputs: [] }),
            baseInput({
              key: "hasFields",
              type: "structuredObject",
              inputs: [baseInput({ key: "name", type: "string" })],
            }),
          ],
        }),
      ],
    });

    expect(result.valueType).toBe(
      '{ configuration: "empty"; values: import("@prismatic-io/spectral/dist/types").StructuredObject } | { configuration: "hasFields"; values: { name: string } }',
    );
  });

  it("falls back to DynamicObject import when configurations are empty", () => {
    const [result] = getInputs({
      inputs: [baseInput({ key: "empty", type: "dynamicObject", inputs: [] })],
    });

    expect(result.valueType).toBe('import("@prismatic-io/spectral/dist/types").DynamicObject');
  });
});
