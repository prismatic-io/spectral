import { describe, expect, it } from "vitest";
import { type Codemod, codemodId, defineCodemod } from "../codemod";
import { codemods, resolveCodemod } from ".";

const fake = (version: string, name = "migrate"): Codemod =>
  defineCodemod({ version, name, description: "", transform: async () => [] });

const available = [
  fake("10.0.0"),
  fake("10.9.0"),
  fake("10.10.0"),
  fake("11.0.0"),
  fake("1.0.0", "other"),
];

const resolved = (requested: string, targetSpectral?: string): string =>
  codemodId(resolveCodemod(requested, targetSpectral, available));

describe("resolveCodemod", () => {
  it("runs a versioned codemod as named", () => {
    expect(resolved("v10.9.0/migrate")).toBe("v10.9.0/migrate");
  });

  it.each([
    ["10.0.0", "v10.0.0/migrate"],
    ["10.3.1", "v10.0.0/migrate"],
    ["10.9.5", "v10.9.0/migrate"],
    ["10.10.0", "v10.10.0/migrate"],
    ["12.0.0", "v11.0.0/migrate"],
  ])("runs the latest version at or below spectral %s", (target, expected) => {
    expect(resolved("migrate", target)).toBe(expected);
  });

  it("counts a preview release as below its release", () => {
    expect(resolved("migrate", "10.10.0-preview.2")).toBe("v10.9.0/migrate");
  });

  it("fails when every version is above the target", () => {
    expect(() => resolved("migrate", "9.9.9")).toThrow(
      'No version of "migrate" applies to spectral 9.9.9. Its versions are 10.0.0, 10.9.0, 10.10.0, 11.0.0.',
    );
  });

  it("needs a target for a codemod named without its version", () => {
    expect(() => resolved("migrate")).toThrow(
      '"migrate" does not name a version. Pass a versioned codemod, such as "v11.0.0/migrate", or the spectral version to migrate to with --target-spectral <version>.',
    );
  });

  it("refuses a target for a codemod named with its version", () => {
    expect(() => resolved("v10.0.0/migrate", "10.3.1")).toThrow(
      '"v10.0.0/migrate" names its version, so it takes no --target-spectral.',
    );
  });

  it("refuses a target that is not a version", () => {
    expect(() => resolved("migrate", "^10.3.1")).toThrow(
      '--target-spectral takes a spectral version, such as 10.3.1. "^10.3.1" is not one.',
    );
  });

  it.each([["v9.0.0/migrate"], ["nope"]])("fails for an unknown codemod: %s", (requested) => {
    expect(() => resolved(requested, requested.startsWith("v") ? undefined : "10.0.0")).toThrow(
      `Unknown codemod "${requested}".`,
    );
  });

  it("refuses a codemod that declares a version that is not a release", () => {
    expect(() =>
      resolveCodemod("migrate", "10.0.0", [fake("10.0.0-preview.1"), fake("10.0.0")]),
    ).toThrow('Codemod "migrate" declares an invalid version: "10.0.0-preview.1".');
  });

  it("finds each shipped codemod by its name and the version it declares", () => {
    for (const [id, codemod] of codemods) {
      expect(id).toBe(`v${codemod.version}/${codemod.name}`);
      expect(resolveCodemod(codemod.name, codemod.version)).toBe(codemod);
    }
  });
});
