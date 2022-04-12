import { expectType } from "tsd";
import type { ActionDefinition } from "../types/ActionDefinition";
import { ActionPerformFunction } from "../types/ActionPerformFunction";
import { Inputs } from "../types/Inputs";

const definition: ActionDefinition<Inputs> = {
  display: { label: "foo", description: "foo" },
  inputs: { foo: { label: "Foo", type: "string" } },
  perform: async (context, { foo }) => Promise.resolve({ data: foo }),
};
expectType<ActionPerformFunction<Inputs, boolean | undefined>>(
  definition.perform
);
