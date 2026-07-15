import type { Exact } from "@prismatic-io/spectral/dist/types/utils";
import { expectAssignable, expectNotAssignable } from "tsd";

type Shape = {
  required: string;
  optional?: number;
};

expectAssignable<Exact<Shape, { required: string }>>({ required: "value" });
expectAssignable<Exact<Shape, { required: string; optional: number }>>({
  required: "value",
  optional: 1,
});
expectNotAssignable<Exact<Shape, { required: string; extra: boolean }>>({
  required: "value",
  extra: true,
});

type Variant = { type: "first"; first: string } | { type: "second"; second: number };

expectAssignable<Exact<Variant, { type: "first"; first: string }>>({
  type: "first",
  first: "value",
});
expectAssignable<Exact<Variant, { type: "second"; second: number }>>({
  type: "second",
  second: 1,
});
expectNotAssignable<Exact<Variant, { type: "first"; first: string; second: number }>>({
  type: "first",
  first: "value",
  second: 1,
});
