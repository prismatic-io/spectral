import { expectType } from "tsd";
import { ExtractValue, KeyValuePair } from "../types/ActionInputParameters";

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
