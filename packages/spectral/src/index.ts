/**
 * This module contains functions to help custom component
 * authors create inputs, actions, and components that can
 * be processed by the Prismatic API.
 */

import {
  ActionDefinition,
  InputFieldDefinition,
  ComponentDefinition,
  DefaultConnectionDefinition,
  OAuth2ConnectionDefinition,
  Inputs,
  TriggerDefinition,
  ActionPerformReturn,
  TriggerResult,
  DataSourceDefinition,
  DataSourceResult,
  DataSourceResultType,
} from "./types";
import { convertComponent } from "./serverTypes/convert";

/**
 * This function creates a component object that can be
 * imported into the Prismatic API. For information on using
 * this function to write custom components, see
 * https://prismatic.io/docs/custom-components/writing-custom-components/#exporting-a-component.
 * @param definition A ComponentDefinition type object, including display information, unique key, and a set of actions the component implements.
 * @returns This function returns a component object that has the shape the Prismatic API expects.
 */
export const component = <T extends boolean>(
  definition: ComponentDefinition<T>
): ReturnType<typeof convertComponent> => convertComponent(definition);

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
  TInputs extends Inputs,
  TAllowsBranching extends boolean,
  TReturn extends ActionPerformReturn<TAllowsBranching, unknown>
>(
  definition: ActionDefinition<TInputs, TAllowsBranching, TReturn>
): ActionDefinition<TInputs, TAllowsBranching, TReturn> => definition;

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
  TInputs extends Inputs,
  TAllowsBranching extends boolean,
  TResult extends TriggerResult<TAllowsBranching>
>(
  definition: TriggerDefinition<TInputs, TAllowsBranching, TResult>
): TriggerDefinition<TInputs, TAllowsBranching, TResult> => definition;

/**
 * This function creates a data source object that can be referenced
 * by a custom component. It helps ensure that the shape of the
 * data source object conforms to what the Prismatic API expects.
 * For information on writing custom component data sources, see
 * https://prismatic.io/docs/custom-components/writing-custom-components/#writing-data-sources.
 * @param definition A DataSourceDefinition type object that includes UI display information, a function to perform when the data source is invoked, and a an object containing inputs for the perform function.
 * @returns This function validates the shape of the `definition` object provided, and returns the same data source object.
 */
export const dataSource = <
  TInputs extends Inputs,
  TResult extends DataSourceResult<DataSourceResultType>
>(
  definition: DataSourceDefinition<TInputs, TResult>
): DataSourceDefinition<TInputs, TResult> => definition;

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
