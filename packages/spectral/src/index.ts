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
  DataSourceType,
  IntegrationDefinition,
  Flow,
  ConfigPage,
  StandardConfigVar,
  ConnectionConfigVar,
  ConfigVarResultCollection,
  TriggerPayload,
  DataSourceConfigVar,
  ConfigPages,
  OnPremiseConnectionDefinition,
} from "./types";
import { convertComponent } from "./serverTypes/convert";
import { convertIntegration } from "./serverTypes/convertIntegration";

/**
 * This function creates a Integration object that can be
 * imported into the Prismatic API. For information on using
 * this function to write code native integrations, see
 * https://prismatic.io/docs/code-native-integrations/.
 * @param definition An IntegrationDefinition type object.
 * @returns This function returns an integration object that has the shape the Prismatic API expects.
 */
export const integration = <TConfigPages extends ConfigPages = ConfigPages>(
  definition: IntegrationDefinition<TConfigPages>
): ReturnType<typeof convertIntegration> => {
  const integrationDefinition = convertIntegration(
    definition as IntegrationDefinition<any>
  );

  if (process.env?.DEBUG === "true") {
    console.info(integrationDefinition.codeNativeIntegrationYAML);
  }
  return integrationDefinition;
};

/**
 * For information on writing Code Native Integrations, see
 * https://prismatic.io/docs/code-native-integrations/#adding-flows.
 * @param definition A Flow type object.
 * @returns This function returns a flow object that has the shape the Prismatic API expects.
 */
export const flow = <
  TConfigPages extends ConfigPages = ConfigPages,
  TTriggerPayload extends TriggerPayload = TriggerPayload,
  T extends Flow<TConfigPages, TTriggerPayload> = Flow<
    TConfigPages,
    TTriggerPayload
  >
>(
  definition: T
): T => definition;

/**
 * For information on writing Code Native Integrations, see
 * https://prismatic.io/docs/code-native-integrations/#adding-config-pages.
 * @param definition A Config Page type object.
 * @returns This function returns a config page object that has the shape the Prismatic API expects.
 */
export const configPage = <T extends ConfigPage>(definition: T): T =>
  definition;

/**
 * For information on writing Code Native Integrations, see
 * https://prismatic.io/docs/code-native-integrations/#adding-config-vars.
 * @param definition A Config Var type object.
 * @returns This function returns a standard config var object that has the shape the Prismatic API expects.
 */
export const configVar = <T extends StandardConfigVar>(definition: T): T =>
  definition;

/**
 * For information on writing Code Native Integrations, see
 * https://prismatic.io/docs/code-native-integrations/#adding-config-vars.
 * @param definition A Data Source Config Var type object.
 * @returns This function returns a data source config var object that has the shape the Prismatic API expects.
 */
export const dataSourceConfigVar = <T extends DataSourceConfigVar>(
  definition: T
): T => definition;

/**
 * For information on writing Code Native Integrations, see
 * https://prismatic.io/docs/code-native-integrations/#adding-config-vars.
 * @param definition A Connection Config Var type object.
 * @returns This function returns a connection config var object that has the shape the Prismatic API expects.
 */
export const connectionConfigVar = <T extends ConnectionConfigVar>(
  definition: T
): T => definition;

/**
 * This function creates a component object that can be
 * imported into the Prismatic API. For information on using
 * this function to write custom components, see
 * https://prismatic.io/docs/custom-components/writing-custom-components/#exporting-a-component.
 * @param definition A ComponentDefinition type object, including display information, unique key, and a set of actions the component implements.
 * @returns This function returns a component object that has the shape the Prismatic API expects.
 */
export const component = <TPublic extends boolean, TKey extends string>(
  definition: ComponentDefinition<TPublic, TKey>
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
  TConfigVar extends ConfigVarResultCollection,
  TAllowsBranching extends boolean,
  TReturn extends ActionPerformReturn<TAllowsBranching, unknown>
>(
  definition: ActionDefinition<TInputs, TConfigVar, TAllowsBranching, TReturn>
): ActionDefinition<TInputs, TConfigVar, TAllowsBranching, TReturn> =>
  definition;

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
  TConfigVar extends ConfigVarResultCollection,
  TAllowsBranching extends boolean,
  TResult extends TriggerResult<TAllowsBranching, TriggerPayload>
>(
  definition: TriggerDefinition<TInputs, TConfigVar, TAllowsBranching, TResult>
): TriggerDefinition<TInputs, TConfigVar, TAllowsBranching, TResult> =>
  definition;

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
  TConfigVars extends ConfigVarResultCollection,
  TDataSourceType extends DataSourceType
>(
  definition: DataSourceDefinition<TInputs, TConfigVars, TDataSourceType>
): DataSourceDefinition<TInputs, TConfigVars, TDataSourceType> => definition;

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
 * For information on writing custom component connections using on-premise resources, see
 * https://prismatic.io/docs/custom-components/writing-custom-components/#adding-connections.
 * @param definition An OnPremiseConnectionDefinition object that describes the type of a connection for a custom component action or trigger, and information on how it should be displayed in the Prismatic WebApp.
 * @returns This function validates the shape of the `definition` object provided and returns the same connection object.
 */
export const onPremiseConnection = <T extends OnPremiseConnectionDefinition>(
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
