import { cleanParams, type CleanFn } from "./perform";

describe("cleanParams", () => {
  it.each<{
    params: Record<string, unknown>;
    cleaners: Record<string, CleanFn | undefined>;
    expected: Record<string, unknown>;
  }>([
    // Ensure all empty produces empty values collection
    { params: {}, cleaners: {}, expected: {} },
    // Ensure matched cleaners produce expected result
    {
      params: { foo: null },
      cleaners: { foo: (v: unknown) => "changed" },
      expected: { foo: "changed" },
    },
    // Ensure cleaners run even if input value not explicitly provided
    {
      params: {},
      cleaners: { foo: (v: unknown) => "ran" },
      expected: { foo: "ran" },
    },
  ])("runs input clean functions", ({ params, cleaners, expected }) => {
    expect(cleanParams(params, cleaners)).toStrictEqual(expected);
  });
});
