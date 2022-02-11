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
  ActionPerformReturn,
  ComponentDefinition,
  ConnectionDefinition,
  DefaultConnectionDefinition,
  OAuth2ConnectionDefinition,
  Inputs,
  ActionPerformBranchingDataReturn,
  ActionPerformDataReturn,
  TriggerDefinition,
  TriggerBaseResult,
  TriggerBranchingResult,
  TriggerResult,
  InputFieldDefaultMap,
} from "./types";
import {
  Action,
  Trigger,
  Connection,
  Component,
  InputField,
  ServerPerformDataStructureReturn,
  ServerPerformBranchingDataStructureReturn,
} from "./types/server-types";

const convertInput = (
  key: string,
  {
    default: defaultValue,
    type,
    label,
    collection,
    ...rest
  }: InputFieldDefinition
): InputField => ({
  ...rest,
  key,
  type,
  default: defaultValue ?? InputFieldDefaultMap[type],
  collection,
  label: typeof label === "string" ? label : label.value,
  keyLabel:
    collection === "keyvaluelist" && typeof label === "object"
      ? label.key
      : undefined,
});

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
    | undefined
    | ActionPerformBranchingDataReturn<unknown>
    | ActionPerformDataReturn<unknown>
  >
): Action => ({
  ...action,
  key: actionKey,
  inputs: Object.entries(action.inputs ?? {}).map(([key, value]) =>
    convertInput(key, value)
  ),
  perform: action.perform as Action["perform"],
  examplePayload: action.examplePayload as
    | ServerPerformDataStructureReturn
    | ServerPerformBranchingDataStructureReturn,
});

/**
 * This is a helper function for component() to convert a
 * trigger defined in TypeScript into an trigger object that
 * Prismatic's API can process.
 * @param triggerKey The unique identifier of a trigger.
 * @param trigger The trigger definition, including its inputs, perform function, and app display information.
 * @returns This function returns a trigger object that has the shape the Prismatic API expects.
 */
const convertTrigger = (
  triggerKey: string,
  trigger: TriggerDefinition<
    Inputs,
    boolean,
    undefined | TriggerBaseResult | TriggerBranchingResult
  >
): Trigger => ({
  ...trigger,
  key: triggerKey,
  inputs: Object.entries(trigger.inputs ?? {}).map(([key, value]) =>
    convertInput(key, value)
  ),
  perform: trigger.perform as Trigger["perform"],
  examplePayload: trigger.examplePayload || undefined,
});

const convertConnection = (connection: ConnectionDefinition): Connection => ({
  ...connection,
  inputs: Object.entries(connection.inputs ?? {}).map(([key, value]) =>
    convertInput(key, value)
  ),
});

/**
 * This function creates a component object that can be
 * imported into the Prismatic API. For information on using
 * this function to write custom components, see
 * https://prismatic.io/docs/custom-components/writing-custom-components/#exporting-a-component.
 * @param definition A ComponentDefinition type object, including display infromation, unique key, and a set of actions the component implements.
 * @returns This function returns a component object that has the shape the Prismatic API expects.
 */
export const component = <T extends boolean>(
  definition: ComponentDefinition<T>
): Component<T> => ({
  ...definition,
  documentationUrl: definition.documentationUrl || null,
  actions: Object.fromEntries(
    Object.entries(definition.actions || {}).map(([actionKey, action]) => [
      actionKey,
      convertAction(actionKey, action),
    ])
  ),
  triggers: Object.fromEntries(
    Object.entries(definition.triggers || {}).map(([triggerKey, trigger]) => [
      triggerKey,
      convertTrigger(triggerKey, trigger),
    ])
  ),
  connections: (definition.connections || []).map(convertConnection),
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
  ReturnData extends ActionPerformReturn<AllowsBranching, unknown>
>(
  definition: ActionDefinition<T, AllowsBranching, ReturnData>
): ActionDefinition<T, AllowsBranching, ReturnData> => definition;

/**
 * This function creates a trigger object that can be referenced
 * by a custom component. It helps ensure that the shape of the
 * trigger object conforms to what the Prismatic API expects.
 * For information on writing custom component triggers, see
 * https://prismatic.io/docs/custom-components/writing-custom-components/#writing-triggers.
 * @param definition A TriggerDefinition type object that includes UI display information, a function to perform when the trigger is invoked, and a an object containing inputs for the perform function.
 * @returns This function validates the shape of the `definition` object provided, and returns the same trigger object.
 */
export const trigger = <
  T extends Inputs,
  AllowsBranching extends boolean,
  Result extends TriggerResult<AllowsBranching>
>(
  definition: TriggerDefinition<T, AllowsBranching, Result>
): TriggerDefinition<T, AllowsBranching, Result> => definition;

/**
 * For information and examples on how to write inputs
 * for custom component actions and triggers, see
 * https://prismatic.io/docs/custom-components/writing-custom-components/#adding-inputs.
 * @param definition An InputFieldDefinition object that describes the type of an input for a custom component action or trigger, and information on how it should be displayed in the Prismatic WebApp.
 * @returns This function validates the shape of the `definition` object provided, and returns the same input object.
 */
export const input = <T extends InputFieldDefinition>(definition: T): T =>
  definition;

/**
 * For information on writing custom component connections, see
 * https://prismatic.io/docs/custom-components/writing-custom-components/#adding-connections.
 * @param definition A DefaultConnectionDefinition object that describes the type of a connection for a custom component action or trigger, and information on how it should be displayed in the Prismatic WebApp.
 * @returns This functions validates the shape of the `definition` object provided and returns the same connection object.
 */
export const connection = <T extends DefaultConnectionDefinition>(
  definition: T
): T => definition;

/**
 * For information on writing custom component connections, see
 * https://prismatic.io/docs/custom-components/writing-custom-components/#adding-connections.
 * @param definition An OAuth2ConnectionDefinition object that describes the type of a connection for a custom component action or trigger, and information on how it should be displayed in the Prismatic WebApp.
 * @returns This functions validates the shape of the `definition` object provided and returns the same connection object.
 */
export const oauth2Connection = <T extends OAuth2ConnectionDefinition>(
  definition: T
): T => definition;

export { default as util } from "./util";
export * from "./types";
export { default as testing } from "./testing";
export * from "./errors";
