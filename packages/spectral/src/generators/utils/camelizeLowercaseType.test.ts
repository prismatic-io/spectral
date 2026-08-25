import { describe, expect, it } from "vitest";
import { InputFieldDefaultMap } from "../../types/Inputs";
import { camelizeLowercaseType } from "./camelizeLowercaseType";

describe("camelizeLowercaseType", () => {
  it("normalizes every supported input type from API enum spellings", () => {
    for (const inputType of Object.keys(InputFieldDefaultMap)) {
      expect(camelizeLowercaseType(inputType.toUpperCase())).toBe(inputType);
      expect(camelizeLowercaseType(inputType.replaceAll(/(?=[A-Z])/g, "_").toUpperCase())).toBe(
        inputType,
      );
    }
  });

  it("preserves unknown types so generated manifests fail visibly", () => {
    expect(camelizeLowercaseType("futuretype")).toBe("futuretype");
  });
});
