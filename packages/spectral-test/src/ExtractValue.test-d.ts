import { ExtractValue, KeyValuePair } from "@prismatic-io/spectral";
import { expectType } from "tsd";

const scalar: ExtractValue<boolean, undefined> = Boolean();
expectType<boolean>(scalar);

const array: ExtractValue<boolean, "valuelist"> = [true];
expectType<boolean[]>(array);

const keyValues: ExtractValue<boolean, "keyvaluelist"> = [
  {
    key: "foo",
    value: true,
  },
];
expectType<KeyValuePair<boolean>[]>(keyValues);
