/**
 * This module contains functions to help custom component and code-native
 * integration authors create inputs, actions, components, and integrations
 * that can run on the Prismatic platform.
 */

import { runWithIntegrationContext } from "./serverTypes";
import { convertComponent } from "./serverTypes/convertComponent";
import { convertIntegration } from "./serverTypes/convertIntegration";
import {
  ActionDefinition,
  ActionPerformReturn,
  ComponentDefinition,
  ComponentManifest,
  ConfigPage,
  ConfigVarResultCollection,
  ConnectionConfigVar,
  CustomerActivatedConnectionConfigVar,
  DataSourceConfigVar,
  DataSourceDefinition,
  DataSourceType,
  DefaultConnectionDefinition,
  Flow,
  InputFieldDefinition,
  Inputs,
  IntegrationDefinition,
  OAuth2ConnectionDefinition,
  OnPremConnectionDefinition,
  OrganizationActivatedConnectionConfigVar,
  StandardConfigVar,
  TriggerDefinition,
  TriggerPayload,
  TriggerResult,
} from "./types";
import type { PollingTriggerDefinition } from "./types/PollingTriggerDefinition";

/**
 * This function creates a code-native integration object that can be
 * imported into Prismatic.
 *
 * @param definition An IntegrationDefinition type object.
 * @returns This function returns an integration object that has the shape the Prismatic API expects.
 * @see {@link https://prismatic.io/docs/integrations/code-native/ | Code-Native Integrations}
 * @example
 * import { integration } from "@prismatic-io/spectral";
 * import flows from "./flows";
 * import { configPages } from "./configPages";
 * import { componentRegistry } from "./componentRegistry";
 *
 * export default integration({
 *   name: "Acme Integration",
 *   description: "Syncs data between Acme and your system",
 *   category: "Communication",
 *   labels: ["chat", "beta"],
 *   iconPath: "icon.png",
 *   version: "1.0.0",
 *   flows,
 *   configPages,
 *   componentRegistry,
 * });
 */
export const integration = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
  T extends IntegrationDefinition<
    TInputs,
    TActionInputs,
    TPayload,
    TAllowsBranching,
    TResult
  > = IntegrationDefinition<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>,
>(
  definition: T,
): ReturnType<
  typeof convertIntegration<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>
> => {
  const integrationDefinition = runWithIntegrationContext<
    TInputs,
    TActionInputs,
    TPayload,
    TAllowsBranching,
    TResult,
    T,
    ReturnType<
      typeof convertIntegration<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>
    >
  >(definition, () => {
    return convertIntegration(definition);
  });

  if (process.env?.DEBUG === "true") {
    console.info(integrationDefinition.codeNativeIntegrationYAML);
  }

  return integrationDefinition;
};

/**
 * This function creates a flow object for use in code-native integrations.
 *
 * @param definition A Flow type object.
 * @returns This function returns a flow object that has the shape the Prismatic API expects.
 * @see {@link https://prismatic.io/docs/integrations/code-native/flows/ | Code-Native Flows}
 * @example
 * // A webhook-triggered flow
 * import { flow } from "@prismatic-io/spectral";
 *
 * export const myFlow = flow({
 *   name: "Process Webhook",
 *   stableKey: "process-webhook",
 *   description: "Receives and processes incoming webhooks",
 *   onTrigger: async (context, payload, params) => {
 *     return Promise.resolve({ payload });
 *   },
 *   onExecution: async (context, params) => {
 *     const { logger, configVars } = context;
 *     const triggerData = params.onTrigger.results;
 *     logger.info("Processing webhook payload");
 *     return Promise.resolve({ data: triggerData });
 *   },
 * });
 *
 * @example
 * // A scheduled flow with cron expression
 * import { flow } from "@prismatic-io/spectral";
 *
 * export const scheduledSync = flow({
 *   name: "Nightly Sync",
 *   stableKey: "nightly-sync",
 *   description: "Syncs data every night at midnight",
 *   schedule: { value: "0 0 * * *", timezone: "America/Chicago" },
 *   onExecution: async (context, params) => {
 *     context.logger.info(`Sync started at ${new Date().toISOString()}`);
 *     return Promise.resolve({ data: null });
 *   },
 * });
 */
export const flow = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
  TTriggerPayload extends TriggerPayload = TriggerPayload,
  T extends Flow<
    TInputs,
    TActionInputs,
    TPayload,
    TAllowsBranching,
    TResult,
    TTriggerPayload
  > = Flow<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult, TTriggerPayload>,
>(
  definition: T,
): T => definition;

/**
 * This function creates a config wizard page object for use in code-native
 * integrations.
 *
 * @param definition A Config Page type object.
 * @returns This function returns a config page object that has the shape the Prismatic API expects.
 * @see {@link https://prismatic.io/docs/integrations/code-native/config-wizard/ | Code-Native Config Wizard}
 * @example
 * import { configPage, connectionConfigVar, configVar } from "@prismatic-io/spectral";
 *
 * export const configPages = {
 *   Connections: configPage({
 *     tagline: "Set up your API connections",
 *     elements: {
 *       "Acme Connection": connectionConfigVar({
 *         stableKey: "acme-connection",
 *         dataType: "connection",
 *         inputs: {
 *           apiKey: { label: "API Key", type: "password", required: true },
 *           baseUrl: { label: "Base URL", type: "string", required: true },
 *         },
 *       }),
 *     },
 *   }),
 *   Configuration: configPage({
 *     tagline: "Configure sync settings",
 *     elements: {
 *       "Sync Interval": configVar({
 *         stableKey: "sync-interval",
 *         dataType: "picklist",
 *         pickList: ["hourly", "daily", "weekly"],
 *         defaultValue: "daily",
 *       }),
 *     },
 *   }),
 * };
 */
export const configPage = <T extends ConfigPage = ConfigPage>(definition: T): T => definition;

/**
 * This function creates a config variable object for code-native integrations.
 *
 * @param definition A Config Var type object.
 * @returns This function returns a standard config var object that has the shape the Prismatic API expects.
 * @see {@link https://prismatic.io/docs/integrations/code-native/config-wizard/#other-config-variable-types-in-code-native-integrations | Config Variable Types}
 * @example
 * import { configVar } from "@prismatic-io/spectral";
 *
 * // String config variable
 * const endpoint = configVar({
 *   stableKey: "api-endpoint",
 *   dataType: "string",
 *   defaultValue: "https://api.example.com",
 *   description: "The base URL of the API",
 * });
 *
 * @example
 * import { configVar } from "@prismatic-io/spectral";
 *
 * // Picklist config variable
 * const region = configVar({
 *   stableKey: "region",
 *   dataType: "picklist",
 *   pickList: ["us-east-1", "us-west-2", "eu-west-1"],
 *   defaultValue: "us-east-1",
 *   description: "AWS region to use",
 * });
 *
 * @example
 * import { configVar } from "@prismatic-io/spectral";
 *
 * // Boolean config variable
 * const enableDebug = configVar({
 *   stableKey: "enable-debug",
 *   dataType: "boolean",
 *   defaultValue: false,
 *   description: "Enable debug logging",
 * });
 *
 * @example
 * import { configVar } from "@prismatic-io/spectral";
 *
 * // Schedule config variable
 * const syncSchedule = configVar({
 *   stableKey: "sync-schedule",
 *   dataType: "schedule",
 *   description: "When to run the sync",
 *   timeZone: "America/Chicago",
 * });
 */
export const configVar = <T extends StandardConfigVar>(definition: T): T => definition;

/**
 * This function creates a data source-backed config variable for code-native
 * integrations.
 *
 * @param definition A Data Source Config Var type object.
 * @returns This function returns a data source config var object that has the shape the Prismatic API expects.
 * @see {@link https://prismatic.io/docs/integrations/code-native/config-wizard/#data-sources-is-code-native-integrations | Data Sources in Code-Native}
 * @example
 * import { dataSourceConfigVar } from "@prismatic-io/spectral";
 *
 * const selectRepository = dataSourceConfigVar({
 *   stableKey: "select-repo",
 *   dataSourceType: "picklist",
 *   description: "Choose a repository from GitHub",
 *   perform: async (context, params) => {
 *     // Fetch repos from an API and return them as picklist options
 *     return { result: ["repo-1", "repo-2", "repo-3"] };
 *   },
 * });
 */
export const dataSourceConfigVar = <TDataSourceConfigVar extends DataSourceConfigVar>(
  definition: TDataSourceConfigVar,
): TDataSourceConfigVar => definition;

/**
 * This function creates a connection config variable for code-native
 * integrations.
 *
 * @param definition A Connection Config Var type object.
 * @returns This function returns a connection config var object that has the shape the Prismatic API expects.
 * @see {@link https://prismatic.io/docs/integrations/code-native/config-wizard/#connections-in-code-native-integrations | Connections in Code-Native}
 * @example
 * import { connectionConfigVar } from "@prismatic-io/spectral";
 * import { acmeConnection } from "./connections";
 *
 * const myConnection = connectionConfigVar({
 *   stableKey: "acme-connection",
 *   ...acmeConnection,
 * });
 *
 * @example
 * import { connectionConfigVar } from "@prismatic-io/spectral";
 *
 * // Inline connection definition
 * const myApiConnection = connectionConfigVar({
 *   stableKey: "my-api-connection",
 *   dataType: "connection",
 *   inputs: {
 *     apiKey: { label: "API Key", type: "password", required: true },
 *     baseUrl: {
 *       label: "Base URL",
 *       type: "string",
 *       required: true,
 *       default: "https://api.example.com",
 *     },
 *   },
 * });
 */
export const connectionConfigVar = <T extends ConnectionConfigVar = ConnectionConfigVar>(
  definition: T,
): T => definition;

/**
 * This function creates a customer-activated connection for code-native
 * integrations. Customer-activated connections are configured by end-users
 * and can be shared across multiple integrations.
 *
 * @param definition A Customer-Activated Connection Config Var type object.
 * @returns This function returns a connection config var object that has the shape the Prismatic API expects.
 * @see {@link https://prismatic.io/docs/integrations/connections/integration-agnostic-connections/customer-activated/ | Customer-Activated Connections}
 * @example
 * import { customerActivatedConnection } from "@prismatic-io/spectral";
 *
 * const sharedSlackConnection = customerActivatedConnection({
 *   stableKey: "shared-slack-connection",
 * });
 */
export const customerActivatedConnection = <T extends { stableKey: string }>(
  definition: T,
): CustomerActivatedConnectionConfigVar => {
  return { ...definition, dataType: "connection" };
};

/**
 * This function creates an org-activated connection for code-native
 * integrations. Org-activated connections are configured once by the
 * organization and shared across all customer instances.
 *
 * @param definition An Organization-Activated Connection Config Var type object.
 * @returns This function returns a connection config var object that has the shape the Prismatic API expects.
 * @see {@link https://prismatic.io/docs/integrations/connections/integration-agnostic-connections/org-activated-customer/ | Org-Activated Connections}
 * @example
 * import { organizationActivatedConnection } from "@prismatic-io/spectral";
 *
 * const orgSlackConnection = organizationActivatedConnection({
 *   stableKey: "org-slack-connection",
 * });
 */
export const organizationActivatedConnection = <T extends { stableKey: string }>(
  definition: T,
): OrganizationActivatedConnectionConfigVar => {
  return { ...definition, dataType: "connection" };
};

/**
 * Generate a manifest of components that this code-native integration relies on.
 * Component manifests allow your code-native integration to reference actions,
 * triggers, connections, and data sources from published Prismatic components.
 *
 * @param definition A Component Manifest type object.
 * @returns This function returns a component manifest object that has the shape the Prismatic API expects.
 * @see {@link https://prismatic.io/docs/integrations/code-native/existing-components/ | Using Existing Components}
 * @example
 * import { componentManifest } from "@prismatic-io/spectral";
 *
 * const slack = componentManifest({
 *   key: "slack",
 *   public: true,
 *   actions: {
 *     postMessage: {
 *       inputs: {
 *         message: { label: "Message" },
 *         channelName: { label: "Channel Name" },
 *       },
 *     },
 *   },
 * });
 */
export const componentManifest = <T extends ComponentManifest>(definition: T): T => definition;

/**
 * This function creates a component object that can be
 * imported into the Prismatic API.
 *
 * @param definition A ComponentDefinition type object, including display information, unique key, and a set of actions the component implements.
 * @returns This function returns a component object that has the shape the Prismatic API expects.
 * @see {@link https://prismatic.io/docs/custom-connectors/ | Custom Connectors}
 * @example
 * import { component } from "@prismatic-io/spectral";
 * import actions from "./actions";
 * import triggers from "./triggers";
 * import connections from "./connections";
 *
 * export default component({
 *   key: "acme-connector",
 *   display: {
 *     label: "Acme",
 *     description: "Interact with Acme's API",
 *     iconPath: "icon.png",
 *   },
 *   actions,
 *   triggers,
 *   connections,
 * });
 */
export const component = <TPublic extends boolean, TKey extends string>(
  definition: ComponentDefinition<TPublic, TKey>,
): ReturnType<typeof convertComponent> => convertComponent(definition);

/**
 * This function creates an action object that can be referenced
 * by a custom component. It helps ensure that the shape of the
 * action object conforms to what the Prismatic API expects.
 *
 * @param definition An ActionDefinition type object that includes UI display information, a function to perform when the action is invoked, and an object containing inputs for the perform function.
 * @returns This function validates the shape of the `definition` object provided, and returns the same action object.
 * @see {@link https://prismatic.io/docs/custom-connectors/actions/ | Writing Custom Actions}
 * @example
 * import { action, input, util } from "@prismatic-io/spectral";
 *
 * const listItems = action({
 *   display: {
 *     label: "List Items",
 *     description: "Retrieve a list of items from Acme",
 *   },
 *   inputs: {
 *     connection: input({ label: "Connection", type: "connection", required: true }),
 *     limit: input({
 *       label: "Limit",
 *       type: "string",
 *       required: false,
 *       default: "100",
 *       comments: "Maximum number of items to return",
 *     }),
 *   },
 *   perform: async (context, { connection, limit }) => {
 *     const maxItems = util.types.toInt(limit, 100);
 *     context.logger.info(`Fetching up to ${maxItems} items`);
 *     // Make API call using connection...
 *     return { data: { items: [] } };
 *   },
 * });
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
 *
 * @param definition A TriggerDefinition type object that includes UI display information, a function to perform when the trigger is invoked, and an object containing inputs for the perform function.
 * @returns This function validates the shape of the `definition` object provided, and returns the same trigger object.
 * @see {@link https://prismatic.io/docs/custom-connectors/triggers/ | Writing Custom Triggers}
 * @example
 * import { trigger, input } from "@prismatic-io/spectral";
 * import { HttpResponse } from "@prismatic-io/spectral";
 *
 * const webhookTrigger = trigger({
 *   display: {
 *     label: "Acme Webhook",
 *     description: "Receives webhooks from Acme",
 *   },
 *   inputs: {
 *     secret: input({
 *       label: "Signing Secret",
 *       type: "password",
 *       required: true,
 *       comments: "Used to verify webhook signatures",
 *     }),
 *   },
 *   scheduleSupport: "invalid",
 *   synchronousResponseSupport: "valid",
 *   perform: async (context, payload, { secret }) => {
 *     // Validate and process the incoming webhook
 *     const response: HttpResponse = {
 *       statusCode: 200,
 *       contentType: "application/json",
 *       body: JSON.stringify({ received: true }),
 *     };
 *     return Promise.resolve({
 *       payload,
 *       response,
 *     });
 *   },
 * });
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
 * by a custom component. A polling trigger runs on a schedule and uses
 * `context.polling` to track state between invocations, enabling detection
 * of new or changed records.
 *
 * @param definition A PollingTriggerDefinition, similar to a TriggerDefinition, except it requires a pollAction instead of a perform. The pollAction, which can be any action defined in the component, will be polled on the defined schedule.
 * @see {@link https://prismatic.io/docs/custom-connectors/triggers/#app-event-polling-triggers | Polling Triggers}
 * @returns This function validates the shape of the `definition` object provided, and returns the same polling trigger object.
 * @example
 * import { pollingTrigger, input } from "@prismatic-io/spectral";
 *
 * const newRecordsTrigger = pollingTrigger({
 *   display: {
 *     label: "New Records",
 *     description: "Triggers when new records are detected",
 *   },
 *   inputs: {
 *     connection: input({ label: "Connection", type: "connection", required: true }),
 *   },
 *   perform: async (context, payload, params) => {
 *     const lastCursor = context.polling.getState()["cursor"] ?? "";
 *     // Fetch records since lastCursor...
 *     const newRecords = []; // results from API
 *     context.polling.setState({ cursor: "new-cursor-value" });
 *     return Promise.resolve({
 *       payload: {
 *         ...payload,
 *         body: { data: newRecords },
 *       },
 *     });
 *   },
 * });
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
 *
 * @param definition A DataSourceDefinition type object that includes UI display information, a function to perform when the data source is invoked, and an object containing inputs for the perform function.
 * @returns This function validates the shape of the `definition` object provided, and returns the same data source object.
 * @see {@link https://prismatic.io/docs/custom-connectors/data-sources/ | Writing Custom Data Sources}
 * @example
 * import { dataSource, input } from "@prismatic-io/spectral";
 *
 * const selectChannel = dataSource({
 *   display: {
 *     label: "Select Channel",
 *     description: "Fetches a list of channels from the API",
 *   },
 *   dataSourceType: "picklist",
 *   inputs: {
 *     connection: input({ label: "Connection", type: "connection", required: true }),
 *   },
 *   perform: async (context, { connection }) => {
 *     // Fetch channels from API using the connection...
 *     return {
 *       result: [
 *         { label: "General", value: "C123" },
 *         { label: "Engineering", value: "C456" },
 *       ],
 *     };
 *   },
 * });
 */
export const dataSource = <
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TDataSourceType extends DataSourceType,
>(
  definition: DataSourceDefinition<TInputs, TConfigVars, TDataSourceType>,
): DataSourceDefinition<TInputs, TConfigVars, TDataSourceType> => definition;

/**
 * This function creates an input definition for a custom component action,
 * trigger, or data source. Inputs define what information is collected from
 * the user when configuring an integration step.
 *
 * @param definition An InputFieldDefinition object that describes the type of an input for a custom component action or trigger, and information on how it should be displayed in the Prismatic WebApp.
 * @see {@link https://prismatic.io/docs/custom-connectors/actions/#action-inputs | Action Inputs}
 * @returns This function validates the shape of the `definition` object provided, and returns the same input object.
 * @example
 * import { input } from "@prismatic-io/spectral";
 *
 * // A basic string input
 * const itemName = input({
 *   label: "Item Name",
 *   type: "string",
 *   required: true,
 *   comments: "The name of the item to create",
 *   example: "My New Item",
 * });
 *
 * @example
 * import { input } from "@prismatic-io/spectral";
 *
 * // A string input with a dropdown of preset choices
 * const priority = input({
 *   label: "Priority",
 *   type: "string",
 *   required: true,
 *   model: [
 *     { label: "Low", value: "low" },
 *     { label: "Medium", value: "medium" },
 *     { label: "High", value: "high" },
 *   ],
 *   default: "medium",
 * });
 *
 * @example
 * import { input } from "@prismatic-io/spectral";
 *
 * // A code input for JSON
 * const requestBody = input({
 *   label: "Request Body",
 *   type: "code",
 *   language: "json",
 *   required: false,
 *   comments: "JSON body to send with the request",
 * });
 *
 * @example
 * import { input } from "@prismatic-io/spectral";
 *
 * // A key-value list collection input
 * const headers = input({
 *   label: "HTTP Headers",
 *   type: "string",
 *   collection: "keyvaluelist",
 *   required: false,
 *   comments: "Additional headers to include in the request",
 * });
 */
export const input = <T extends InputFieldDefinition>(definition: T): T => definition;

/**
 * This function creates a connection that can be used by a code-native integration
 * or custom component. Connections define the fields (API keys, tokens, etc.) needed
 * to authenticate with a third-party service.
 *
 * @param definition A DefaultConnectionDefinition object that describes the type of a connection for a custom component action or trigger, and information on how it should be displayed in the Prismatic WebApp.
 * @see {@link https://prismatic.io/docs/custom-connectors/connections/ | Writing Custom Connections}
 * @returns This function validates the shape of the `definition` object provided and returns the same connection object.
 * @example
 * import { connection } from "@prismatic-io/spectral";
 *
 * const apiKeyConnection = connection({
 *   key: "apiKey",
 *   display: {
 *     label: "Acme API Key",
 *     description: "Authenticate with Acme using an API key",
 *   },
 *   inputs: {
 *     apiKey: {
 *       label: "API Key",
 *       type: "password",
 *       required: true,
 *       comments: "Generate an API key from your Acme dashboard",
 *     },
 *     baseUrl: {
 *       label: "Base URL",
 *       type: "string",
 *       required: true,
 *       default: "https://api.acme.com/v2",
 *     },
 *   },
 * });
 */
export const connection = <T extends DefaultConnectionDefinition>(definition: T): T => definition;

/**
 * This function creates an on-prem connection for a code-native integration or custom component.
 * On-prem connections include `host` and `port` fields that are automatically overridden by the
 * on-prem agent with local tunnel endpoints.
 *
 * @param definition An OnPremConnectionDefinition object that describes the type of a connection for a custom component action or trigger, and information on how it should be displayed in the Prismatic WebApp.
 * @see {@link https://prismatic.io/docs/integrations/connections/on-prem-agent/#supporting-on-prem-connections-in-a-custom-connector | On-Prem Connections}
 * @returns This function validates the shape of the `definition` object provided and returns the same connection object.
 * @example
 * import { onPremConnection } from "@prismatic-io/spectral";
 *
 * const databaseConnection = onPremConnection({
 *   key: "onPremDatabase",
 *   display: {
 *     label: "On-Prem Database",
 *     description: "Connect to an on-premise database through the Prismatic agent",
 *   },
 *   inputs: {
 *     host: {
 *       label: "Host",
 *       type: "string",
 *       required: true,
 *       onPremControlled: true,
 *       comments: "Overridden when on-prem is enabled",
 *     },
 *     port: {
 *       label: "Port",
 *       type: "string",
 *       required: true,
 *       onPremControlled: true,
 *       default: "5432",
 *     },
 *     username: {
 *       label: "Username",
 *       type: "string",
 *       required: true,
 *     },
 *     password: {
 *       label: "Password",
 *       type: "password",
 *       required: true,
 *     },
 *   },
 * });
 */
export const onPremConnection = <T extends OnPremConnectionDefinition>(definition: T): T =>
  definition;

/**
 * This function creates an OAuth 2.0 connection for a code-native integration or custom component.
 * Supports both Authorization Code and Client Credentials grant types.
 *
 * @param definition An OAuth2ConnectionDefinition object that describes the type of a connection for a custom component action or trigger, and information on how it should be displayed in the Prismatic WebApp.
 * @see {@link https://prismatic.io/docs/custom-connectors/connections/#writing-oauth-20-connections | OAuth 2.0 Connections}
 * @returns This function validates the shape of the `definition` object provided and returns the same connection object.
 * @example
 * import { oauth2Connection, OAuth2Type } from "@prismatic-io/spectral";
 *
 * // Authorization Code OAuth 2.0 connection
 * const acmeOAuth = oauth2Connection({
 *   key: "acmeOAuth",
 *   display: {
 *     label: "Acme OAuth 2.0",
 *     description: "Authenticate with Acme using OAuth 2.0",
 *   },
 *   oauth2Type: OAuth2Type.AuthorizationCode,
 *   inputs: {
 *     authorizeUrl: {
 *       label: "Authorize URL",
 *       type: "string",
 *       required: true,
 *       default: "https://app.acme.com/oauth2/authorize",
 *       shown: false,
 *     },
 *     tokenUrl: {
 *       label: "Token URL",
 *       type: "string",
 *       required: true,
 *       default: "https://app.acme.com/oauth2/token",
 *       shown: false,
 *     },
 *     scopes: {
 *       label: "Scopes",
 *       type: "string",
 *       required: true,
 *       default: "read write",
 *       comments: "Space-delimited OAuth 2.0 permission scopes",
 *     },
 *     clientId: {
 *       label: "Client ID",
 *       type: "string",
 *       required: true,
 *     },
 *     clientSecret: {
 *       label: "Client Secret",
 *       type: "password",
 *       required: true,
 *     },
 *   },
 * });
 */
export const oauth2Connection = <T extends OAuth2ConnectionDefinition>(definition: T): T =>
  definition;

/**
 * Register multiple component manifests for a code-native integration.
 * Each manifest declares a published Prismatic component and the specific
 * actions, triggers, connections, and data sources your integration uses.
 *
 * @param definition A record of Component Manifest objects keyed by component name.
 * @returns This function returns the same record of component manifests.
 * @see {@link https://prismatic.io/docs/integrations/code-native/existing-components/ | Using Existing Components}
 * @example
 * import { componentManifests } from "@prismatic-io/spectral";
 *
 * export const componentRegistry = componentManifests({
 *   slack: {
 *     key: "slack",
 *     public: true,
 *     actions: {
 *       postMessage: { inputs: { message: { label: "Message" } } },
 *     },
 *   },
 *   dropbox: {
 *     key: "dropbox",
 *     public: true,
 *     actions: {
 *       uploadFile: { inputs: { filePath: { label: "File Path" } } },
 *     },
 *   },
 * });
 */
export const componentManifests = <T extends Record<string, ComponentManifest>>(definition: T): T =>
  definition;

export * from "./errors";
export { default as testing } from "./testing";
export * from "./types";
export { default as util } from "./util";
