import { describe, expect, it } from "vitest";
import { dataSourceResultSchemaFor, storedAsString, zodSchemaFor } from "./zodSchema";

describe("zodSchemaFor", () => {
  it.each([
    ["string", "z.string()"],
    ["code", "z.string()"],
    ["htmlElement", "z.string()"],
    ["date", "z.iso.date()"],
    ["timestamp", "z.iso.datetime({ local: true, offset: true })"],
    ["boolean", "z.boolean()"],
    ["number", "z.number()"],
    ["jsonForm", "z.unknown()"],
    ["picklist", "z.string()"],
  ])("maps %s", (valueType, expected) => {
    expect(zodSchemaFor({ valueType })).toBe(expected);
  });

  it("describes JSON code as the parsed document and other code as text", () => {
    expect(zodSchemaFor({ valueType: "code", codeLanguage: "json" })).toBe("z.json()");
    expect(zodSchemaFor({ valueType: "code", codeLanguage: "xml" })).toBe("z.string()");
    expect(
      zodSchemaFor({ valueType: "code", codeLanguage: "json", collectionType: "valuelist" }),
    ).toBe("z.array(z.json())");
  });

  it("uses the literal choices of a picklist", () => {
    expect(zodSchemaFor({ valueType: "picklist", pickList: ["a", "b"] })).toBe(
      'z.enum(["a", "b"])',
    );
  });

  it("wraps collections", () => {
    expect(zodSchemaFor({ valueType: "number", collectionType: "valuelist" })).toBe(
      "z.array(z.number())",
    );
    expect(zodSchemaFor({ valueType: "boolean", collectionType: "keyvaluelist" })).toBe(
      "z.array(z.object({ key: z.string(), value: z.boolean() }))",
    );
  });

  it("falls back to unknown for a value type it cannot see", () => {
    expect(zodSchemaFor({})).toBe("z.unknown()");
    expect(zodSchemaFor({ collectionType: "valuelist" })).toBe("z.array(z.unknown())");
  });
});

describe("dataSourceResultSchemaFor", () => {
  it("describes the choices a picklist returns, not the value a person saves", () => {
    expect(dataSourceResultSchemaFor("picklist")).toBe(
      "z.union([z.array(z.string()), z.array(elementSchema)])",
    );
  });

  it("describes a schedule by the value it returns", () => {
    expect(dataSourceResultSchemaFor("schedule")).toBe("z.object({ value: z.string() })");
  });

  it("falls back to unknown for a data source type it cannot see", () => {
    expect(dataSourceResultSchemaFor(undefined)).toBe("z.unknown()");
  });
});

describe("storedAsString", () => {
  it.each([
    [{ valueType: "number", collectionType: "valuelist" }, true],
    [{ valueType: "boolean", collectionType: "keyvaluelist" }, true],
    [{ valueType: "code", codeLanguage: "json", collectionType: "valuelist" }, true],
    [{ valueType: "string", collectionType: "valuelist" }, false],
    [{ valueType: "date", collectionType: "valuelist" }, false],
    [{ valueType: "number" }, false],
  ] as const)("reports %o as %s", (shape, expected) => {
    expect(storedAsString(shape)).toBe(expected);
  });
});
