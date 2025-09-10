/**
 * This module contains functions to help custom component and code-native
 * integration authors create inputs, actions, components, and integrations
 * that can run on the Prismatic platform.
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
  OnPremConnectionDefinition,
  ComponentManifest,
  OrganizationActivatedConnectionConfigVar,
  CustomerActivatedConnectionConfigVar,
} from "./types";
import { convertComponent } from "./serverTypes/convertComponent";
import { convertIntegration } from "./serverTypes/convertIntegration";
import type { PollingTriggerDefinition } from "./types/PollingTriggerDefinition";

/**
 * This function creates a code-native integration object that can be
 * imported into Prismatic. For information on using this function to
 * write code-native integrations, see
 * https://prismatic.io/docs/integrations/code-native/.
 *
 * @param definition An IntegrationDefinition type object.
 * @returns This function returns an integration object that has the shape the Prismatic API expects.
 */
export const integration = <T extends IntegrationDefinition = IntegrationDefinition>(
  definition: T,
): ReturnType<typeof convertIntegration> => {
  const integrationDefinition = convertIntegration(definition);

  if (process.env?.DEBUG === "true") {
    console.info(integrationDefinition.codeNativeIntegrationYAML);
  }

  return integrationDefinition;
};

/**
 * This function creates a flow object for use in code-native integrations.
 * For information on writing code-native flows, see
 * https://prismatic.io/docs/integrations/code-native/flows/.
 *
 * @param definition A Flow type object.
 * @returns This function returns a flow object that has the shape the Prismatic API expects.
 */
export const flow = <
  TTriggerPayload extends TriggerPayload = TriggerPayload,
  T extends Flow<TTriggerPayload> = Flow<TTriggerPayload>,
>(
  definition: T,
): T => definition;

/**
 * This function creates a config wizard page object for use in code-native
 * integrations. For information on code-native config wizards, see
 * https://prismatic.io/docs/integrations/code-native/config-wizard/.
 *
 * @param definition A Config Page type object.
 * @returns This function returns a config page object that has the shape the Prismatic API expects.
 */
export const configPage = <T extends ConfigPage = ConfigPage>(definition: T): T => definition;

/**
 * This function creates a config variable object for code-native integrations.
 * For information on writing code-native integrations, see
 * https://prismatic.io/docs/integrations/code-native/config-wizard/#other-config-variable-types-in-code-native-integrations.
 *
 * @param definition A Config Var type object.
 * @returns This function returns a standard config var object that has the shape the Prismatic API expects.
 */
export const configVar = <T extends StandardConfigVar>(definition: T): T => definition;

/**
 * This function creates a data source-backed config variable for code-native
 * integrations. For information on code-native data sources, see
 * https://prismatic.io/docs/integrations/code-native/config-wizard/#data-sources-is-code-native-integrations.
 *
 * @param definition A Data Source Config Var type object.
 * @returns This function returns a data source config var object that has the shape the Prismatic API expects.
 */
export const dataSourceConfigVar = <TDataSourceConfigVar extends DataSourceConfigVar>(
  definition: TDataSourceConfigVar,
): TDataSourceConfigVar => definition;

/**
 * This function creates a connection config variable for code-native
 * integrations. For information on writing code-native integrations, see
 * https://prismatic.io/docs/integrations/code-native/config-wizard/#connections-in-code-native-integrations.
 *
 * @param definition A Connection Config Var type object.
 * @returns This function returns a connection config var object that has the shape the Prismatic API expects.
 */
export const connectionConfigVar = <T extends ConnectionConfigVar = ConnectionConfigVar>(
  definition: T,
): T => definition;

/**
 * This function creates a customer-activated connection for code-native
 * integrations. For information on writing code-native integrations, see
 * https://prismatic.io/docs/integrations/code-native/.
 * For information on customer-activated connections, see
 * https://prismatic.io/docs/integrations/connections/integration-agnostic-connections/customer-activated/.
 *
 * @param definition A Customer-Activated Connection Config Var type object.
 * @returns This function returns a connection config var object that has the shape the Prismatic API expects.
 */
export const customerActivatedConnection = <T extends { stableKey: string }>(
  definition: T,
): CustomerActivatedConnectionConfigVar => {
  return { ...definition, dataType: "connection" };
};

/**
 * This function creates an org-activated connection for code-native
 * integrations. For information on writing code-native integrations, see
 * https://prismatic.io/docs/integrations/code-native/.
 * For information on customer-activated connections, see
 * https://prismatic.io/docs/integrations/connections/integration-agnostic-connections/org-activated-customer/.
 *
 * @param definition An Organization-Activated Connection Config Var type object.
 * @returns This function returns a connection config var object that has the shape the Prismatic API expects.
 */
export const organizationActivatedConnection = <T extends { stableKey: string }>(
  definition: T,
): OrganizationActivatedConnectionConfigVar => {
  return { ...definition, dataType: "connection" };
};

/**
 * Generate a manifest of components that this code-native integration relies on. See
 * https://prismatic.io/docs/integrations/code-native/existing-components/
 *
 * @param definition A Component Manifest type object.
 * @returns This function returns a component manifest object that has the shape the Prismatic API expects.
 */
export const componentManifest = <T extends ComponentManifest>(definition: T): T => definition;

/**
 * This function creates a component object that can be
 * imported into the Prismatic API. For information on using
 * this function to write custom components, see
 * https://prismatic.io/docs/custom-connectors/.
 *
 * @param definition A ComponentDefinition type object, including display information, unique key, and a set of actions the component implements.
 * @returns This function returns a component object that has the shape the Prismatic API expects.
 */
export const component = <TPublic extends boolean, TKey extends string>(
  definition: ComponentDefinition<TPublic, TKey>,
): ReturnType<typeof convertComponent> => convertComponent(definition);

/**
 * This function creates an action object that can be referenced
 * by a custom component. It helps ensure that the shape of the
 * action object conforms to what the Prismatic API expects.
 * For information on writing custom component actions, see
 * https://prismatic.io/docs/custom-connectors/actions/.
 *
 * @param definition An ActionDefinition type object that includes UI display information, a function to perform when the action is invoked, and a an object containing inputs for the perform function.
 * @returns This function validates the shape of the `definition` object provided, and returns the same action object.
 */
export const action = <
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TAllowsBranching extends boolean,
  TReturn extends ActionPerformReturn<TAllowsBranching, unknown>,
>(
  definition: ActionDefinition<TInputs, TConfigVars, TAllowsBranching, TReturn>,
): ActionDefinition<TInputs, TConfigVars, TAllowsBranching, TReturn> => definition;

/**
 * This function creates a trigger object that can be referenced
 * by a custom component. It helps ensure that the shape of the
 * trigger object conforms to what the Prismatic API expects.
 * For information on writing custom component triggers, see
 * https://prismatic.io/docs/custom-connectors/triggers/.
 *
 * @param definition A TriggerDefinition type object that includes UI display information, a function to perform when the trigger is invoked, and a an object containing inputs for the perform function.
 * @returns This function validates the shape of the `definition` object provided, and returns the same trigger object.
 */
export const trigger = <
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TAllowsBranching extends boolean,
  TResult extends TriggerResult<TAllowsBranching, TriggerPayload>,
>(
  definition: TriggerDefinition<TInputs, TConfigVars, TAllowsBranching, TResult>,
): TriggerDefinition<TInputs, TConfigVars, TAllowsBranching, TResult> => definition;

/**
 * This function creates a polling trigger object that can be referenced
 * by a custom component. See
 * https://prismatic.io/docs/custom-connectors/triggers/#app-event-polling-triggers
 *
 * @param definition A PollingTriggerDefinition is similar to a TriggerDefinition, except it requires a pollAction instead of a perform. The pollAction, which can be any action defined in the component, will be polled on the defined schedule.
 * @returns This function validates the shape of the `definition` object provided, and returns the same polling trigger object.
 */
export const pollingTrigger = <
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TPayload extends TriggerPayload,
  TAllowsBranching extends boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload>,
  TActionInputs extends Inputs,
>(
  definition: PollingTriggerDefinition<
    TInputs,
    TConfigVars,
    TPayload,
    TAllowsBranching,
    TResult,
    TActionInputs
  >,
): PollingTriggerDefinition<
  TInputs,
  TConfigVars,
  TPayload,
  TAllowsBranching,
  TResult,
  TActionInputs
> => {
  return { ...definition, triggerType: "polling" };
};

/**
 * This function creates a data source object that can be referenced
 * by a custom component. It helps ensure that the shape of the
 * data source object conforms to what the Prismatic API expects.
 * For information on writing custom component data sources, see
 * https://prismatic.io/docs/custom-connectors/data-sources/.
 *
 * @param definition A DataSourceDefinition type object that includes UI display information, a function to perform when the data source is invoked, and a an object containing inputs for the perform function.
 * @returns This function validates the shape of the `definition` object provided, and returns the same data source object.
 */
export const dataSource = <
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TDataSourceType extends DataSourceType,
>(
  definition: DataSourceDefinition<TInputs, TConfigVars, TDataSourceType>,
): DataSourceDefinition<TInputs, TConfigVars, TDataSourceType> => definition;

/**
 * For information and examples on how to write inputs
 * for custom component actions and triggers, see
 * https://prismatic.io/docs/custom-connectors/actions/#action-inputs.
 *
 * @param definition An InputFieldDefinition object that describes the type of an input for a custom component action or trigger, and information on how it should be displayed in the Prismatic WebApp.
 * @returns This function validates the shape of the `definition` object provided, and returns the same input object.
 */
export const input = <T extends InputFieldDefinition>(definition: T): T => definition;

/**
 * This function creates a connection that can be used by a code-native integration
 * or custom component. For information on writing connections, see
 * https://prismatic.io/docs/custom-connectors/connections/.
 *
 * @param definition A DefaultConnectionDefinition object that describes the type of a connection for a custom component action or trigger, and information on how it should be displayed in the Prismatic WebApp.
 * @returns This functions validates the shape of the `definition` object provided and returns the same connection object.
 */
export const connection = <T extends DefaultConnectionDefinition>(definition: T): T => definition;

/**
 * This function creates an on-prem connection for a code-native integration or custom component.
 * For information on writing custom component connections using on-prem resources, see
 * https://prismatic.io/docs/integrations/connections/on-prem-agent/#supporting-on-prem-connections-in-a-custom-connector.
 *
 * @param definition An OnPremConnectionDefinition object that describes the type of a connection for a custom component action or trigger, and information on how it should be displayed in the Prismatic WebApp.
 * @returns This function validates the shape of the `definition` object provided and returns the same connection object.
 */
export const onPremConnection = <T extends OnPremConnectionDefinition>(definition: T): T =>
  definition;

/**
 * This function creates an OAuth 2.0 connection for a code-native integration or custom component.
 * For information on writing an OAuth 2.0 connection, see
 * https://prismatic.io/docs/custom-connectors/connections/#writing-oauth-20-connections.
 *
 * @param definition An OAuth2ConnectionDefinition object that describes the type of a connection for a custom component action or trigger, and information on how it should be displayed in the Prismatic WebApp.
 * @returns This functions validates the shape of the `definition` object provided and returns the same connection object.
 */
export const oauth2Connection = <T extends OAuth2ConnectionDefinition>(definition: T): T =>
  definition;

export const componentManifests = <T extends Record<string, ComponentManifest>>(definition: T): T =>
  definition;

export { default as util } from "./util";
export * from "./types";
export { default as testing } from "./testing";
export * from "./errors";
