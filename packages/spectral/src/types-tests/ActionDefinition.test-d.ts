import { expectAssignable } from "tsd";
import { action, ActionPerformDataReturn } from "..";
import { ActionPerformFunction } from "../types/ActionPerformFunction";
import { ConfigVarResultCollection, Inputs } from "../types/Inputs";

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
