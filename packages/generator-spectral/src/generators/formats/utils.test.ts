import { createDescription, cleanIdentifier } from "./utils";

describe("createDescription", () => {
  it.each([{ value: "Bob's", expected: "Bob's" }])(
    "should not flip quotes",
    ({ value, expected }) => {
      expect(createDescription(value)).toStrictEqual(expected);
    }
  );
});

describe("cleanIdentifier", () => {
  it.each([
    { value: "foo/bar", expected: "fooBar" },
    { value: ",foo_bar", expected: "fooBar" },
    { value: "12345foobar", expected: "one2345Foobar" },
    { value: "0", expected: "zero" },
    { value: "default", expected: "defaultValue" },
    { value: "case", expected: "aCase" },
  ])("produces clean identifiers", ({ value, expected }) => {
    expect(cleanIdentifier(value)).toStrictEqual(expected);
  });
});
