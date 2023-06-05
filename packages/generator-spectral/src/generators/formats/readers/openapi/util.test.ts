import { toOperationName } from "./util";

describe("toOperationName", () => {
  it.each([
    { value: "foo/bar", expected: "fooBar" },
    { value: ",foo_bar", expected: "fooBar" },
    { value: "12345foobar", expected: "one2345Foobar" },
  ])("sanitizes operation ids", ({ value, expected }) => {
    expect(toOperationName(value)).toEqual(expected);
  });
});
