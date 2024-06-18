import {
  UnionToIntersection,
  UnionToArray,
  IsUnion,
  ValueOf,
} from "@prismatic-io/spectral/dist/types/utils";

import { expectAssignable } from "tsd";

type TestUnion = "one" | "two" | "three";

// IsUnion
expectAssignable<true>("" as unknown as IsUnion<"one" | "two">);
expectAssignable<true>("" as unknown as IsUnion<string | number>);

expectAssignable<false>("" as unknown as IsUnion<string>);

// UnionToArray

(array: UnionToArray<TestUnion>) => {
  expectAssignable<["one", "two", "three"]>(array);
};

// UnionToIntersection
(
  intersection: UnionToIntersection<
    TestUnion extends infer TMember
      ? TMember extends TestUnion
        ? { [Key in TMember]: TMember }
        : never
      : never
  >
) => {
  expectAssignable<{ one: "one" } & { two: "two" } & { three: "three" }>(
    intersection
  );

  expectAssignable<{ one: "one"; two: "two"; three: "three" }>(intersection);
};

// ValueOf
(
  value: ValueOf<{
    one: "one";
    two: "two";
    three: "three";
  }>
) => {
  expectAssignable<"one" | "two" | "three">(value);
};
