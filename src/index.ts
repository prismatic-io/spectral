import {
  ActionDefinition,
  InputFieldDefinition,
  PerformReturn,
  Inputs,
  PerformBranchingDataReturn,
  PerformDataReturn,
} from "./types";
import {
  ActionDefinition as ActionDefinitionV1,
  ComponentDefinition,
  PerformDataStructureReturn,
  PerformBranchingDataStructureReturn,
} from "./server-types";

const convertAction = (
  action: ActionDefinition<
    Inputs,
    boolean,
    void | PerformBranchingDataReturn<unknown> | PerformDataReturn<unknown>
  >
): ActionDefinitionV1 => {
  const items = Object.entries(action.inputs);

  const inputDefinitions = items.map(([key, value]) => ({
    key,
    ...(typeof value === "object" ? value : {}),
  })) as ActionDefinitionV1["inputs"];

  return {
    ...action,
    inputs: inputDefinitions,
    perform: action.perform as ActionDefinitionV1["perform"],
    examplePayload: action.examplePayload as
      | PerformDataStructureReturn
      | PerformBranchingDataStructureReturn,
  };
};

export const component = (
  definition: Omit<ComponentDefinition, "actions"> & {
    actions: Record<
      string,
      ActionDefinition<any, boolean, PerformReturn<boolean, any>>
    >;
  }
) => ({
  ...definition,
  actions: Object.fromEntries(
    Object.entries(definition.actions).map(([actionKey, action]) => [
      actionKey,
      convertAction(action),
    ])
  ),
});

export const action = <
  T extends Inputs,
  AllowsBranching extends boolean,
  ReturnData extends PerformReturn<AllowsBranching, unknown>
>(
  action: ActionDefinition<T, AllowsBranching, ReturnData>
) => action;

export const input = <T extends InputFieldDefinition>(definition: T) =>
  definition;

export { default as util } from "./util";
export * from "./types";
export { default as testing } from "./testing";
