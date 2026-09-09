import { describe, expect, it } from "vitest";
import { zodSchemaFor } from "./zodSchema";

describe("zodSchemaFor", () => {
  it.each([
    ["string", "z.string()"],
    ["code", "z.string()"],
    ["htmlElement", "z.string()"],
    ["date", "z.iso.date()"],
    ["timestamp", "z.iso.datetime()"],
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
