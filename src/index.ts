/**
 * This module contains functions to help custom component
 * authors create inputs, actions, and components that can
 * be processed by the Prismatic API.
 */

/**
 * Both component author-facing types and server types that
 * the Prismatic API expects are imported here.
 */
import {
  ActionDefinition,
  InputFieldDefinition,
  PerformReturn,
  Inputs,
  PerformBranchingDataReturn,
  PerformDataReturn,
} from "./types";
import {
  Action,
  Component,
  ServerPerformDataStructureReturn,
  ServerPerformBranchingDataStructureReturn,
} from "./types/server-types";

/**
 * This is a helper function for component() to convert an
 * action defined in TypeScript into an action object that
 * Prismatic's API can process.
 * @param actionKey The unique identifier of an action.
 * @param action The action definition, including its inputs, perform function, and app display information.
 * @returns This function returns an action object that has the shape the Prismatic API expects.
 */
const convertAction = (
  actionKey: string,
  action: ActionDefinition<
    Inputs,
    boolean,
    void | PerformBranchingDataReturn<unknown> | PerformDataReturn<unknown>
  >
): Action => {
  const items = Object.entries(action.inputs);

  const inputDefinitions = items.map(([key, value]) => ({
    key,
    ...(typeof value === "object" ? value : {}),
  })) as Action["inputs"];

  return {
    ...action,
    key: actionKey,
    inputs: inputDefinitions,
    perform: action.perform as Action["perform"],
    examplePayload: action.examplePayload as
      | ServerPerformDataStructureReturn
      | ServerPerformBranchingDataStructureReturn,
  };
};

/**
 * This function creates a component object that can be
 * imported into the Prismatic API. For information on using
 * this function to write custom components, see
 * https://prismatic.io/docs/custom-components/writing-custom-components/#exporting-a-component.
 * @param definition A ComponentDefinition type object, including display infromation, unique key, authorization information, and a set of actions the component implements.
 * @returns This function returns a component object that has the shape the Prismatic API expects.
 */
export const component = <T extends boolean>(
  definition: Omit<Component<T>, "actions"> & {
    actions: Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ActionDefinition<any, boolean, PerformReturn<boolean, any>>
    >;
  }
): Component<T> => ({
  version: "placeholder", // Placeholder until we deprecate version in component definitions
  ...definition,
  actions: Object.fromEntries(
    Object.entries(definition.actions).map(([actionKey, action]) => [
      actionKey,
      convertAction(actionKey, action),
    ])
  ),
});

/**
 * This function creates an action object that can be referenced
 * by a custom component. It helps ensure that the shape of the
 * action object conforms to what the Prismatic API expects.
 * For information on writing custom component actions, see
 * https://prismatic.io/docs/custom-components/writing-custom-components/#writing-actions.
 * @param definition An ActionDefinition type object that includes UI display information, a function to perform when the action is invoked, and a an object containing inputs for the perform function.
 * @returns This function validates the shape of the `definition` object provided, and returns the same action object.
 */
export const action = <
  T extends Inputs,
  AllowsBranching extends boolean,
  ReturnData extends PerformReturn<AllowsBranching, unknown>
>(
  definition: ActionDefinition<T, AllowsBranching, ReturnData>
): ActionDefinition<T, AllowsBranching, ReturnData> => definition;

/**
 * For information and examples on how to write inputs
 * for custom component actions, see
 * https://prismatic.io/docs/custom-components/writing-custom-components/#adding-inputs.
 * @param definition An InputFieldDefinition object that describes the type of an input for a custom component action, and information on how it should be displayed in the Prismatic WebApp.
 * @returns This function validates the shape of the `definition` object provided, and returns the same input object.
 */
export const input = <T extends InputFieldDefinition>(definition: T): T =>
  definition;

export { default as util } from "./util";
export * from "./types";
export { default as testing } from "./testing";
