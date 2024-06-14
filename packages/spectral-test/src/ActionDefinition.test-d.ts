import {
  action,
  ActionPerformDataReturn,
  ActionPerformFunction,
  ConfigVarResultCollection,
  Inputs,
} from "@prismatic-io/spectral";
import { expectAssignable } from "tsd";

const inputs: Inputs = { foo: { label: "Foo", type: "string" } };

const definition = action({
  display: { label: "foo", description: "foo" },
  inputs,
  perform: async (context, { foo }) => Promise.resolve({ data: foo }),
});

expectAssignable<
  ActionPerformFunction<
    Inputs,
    ConfigVarResultCollection,
    boolean,
    ActionPerformDataReturn<unknown>
  >
>(definition.perform);
