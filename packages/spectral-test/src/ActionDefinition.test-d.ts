import {
  ActionPerformDataReturn,
  ActionPerformFunction,
  action,
  ComponentManifestAction,
  ConfigVarResultCollection,
  Inputs,
} from "@prismatic-io/spectral";
import { expectAssignable } from "tsd";

const inputs: Inputs = { foo: { label: "Foo", type: "string" } };

const definition = action({
  display: { label: "foo", description: "foo" },
  inputs,
  perform: async (_context, { foo }) => Promise.resolve({ data: foo }),
});

expectAssignable<
  ActionPerformFunction<
    Inputs,
    ConfigVarResultCollection,
    Record<string, Record<string, ComponentManifestAction>>,
    boolean,
    ActionPerformDataReturn<unknown>
  >
>(definition.perform);
