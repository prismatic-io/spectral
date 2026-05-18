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
          configurations: [
            {
              key: "contact",
              type: "configuration",
              label: "Contact",
              inputs: [
                baseInput({ key: "firstName", type: "string" }),
                baseInput({ key: "lastName", type: "string" }),
              ],
            } as unknown as ServerTypeInput,
            {
              key: "account",
              type: "configuration",
              label: "Account",
              inputs: [baseInput({ key: "companyName", type: "string" })],
            } as unknown as ServerTypeInput,
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
          configurations: [
            {
              key: "contact",
              type: "configuration",
              label: "Contact",
              inputs: [
                {
                  key: "name",
                  type: "structuredObject",
                  label: "Name",
                  inputs: [
                    baseInput({ key: "first", type: "string" }),
                    baseInput({ key: "last", type: "string" }),
                  ],
                } as unknown as ServerTypeInput,
                baseInput({ key: "email", type: "string" }),
              ],
            } as unknown as ServerTypeInput,
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
          configurations: [
            {
              key: "empty",
              type: "configuration",
              label: "Empty",
              inputs: [],
            } as unknown as ServerTypeInput,
            {
              key: "hasFields",
              type: "configuration",
              label: "Has Fields",
              inputs: [baseInput({ key: "name", type: "string" })],
            } as unknown as ServerTypeInput,
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
      inputs: [baseInput({ key: "empty", type: "dynamicObject", configurations: [] })],
    });

    expect(result.valueType).toBe('import("@prismatic-io/spectral/dist/types").DynamicObject');
  });
});
