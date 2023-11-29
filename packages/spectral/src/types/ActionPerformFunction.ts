import {
  Inputs,
  ActionPerformReturn,
  ActionInputParameters,
  ActionLogger,
  InstanceAttributes,
  CustomerAttributes,
  UserAttributes,
  IntegrationAttributes,
  FlowAttributes,
} from ".";

/** Definition of the function to perform when an Action is invoked. */
export type ActionPerformFunction<
  TInputs extends Inputs,
  TAllowsBranching extends boolean | undefined,
  TReturn extends ActionPerformReturn<TAllowsBranching, unknown>
> = (
  context: ActionContext,
  params: ActionInputParameters<TInputs>
) => Promise<TReturn>;

/** Context provided to perform method containing helpers and contextual data */
export interface ActionContext {
  /** Logger for permanent logging; console calls are also captured */
  logger: ActionLogger;
  /** Code Components and Code Native Integration Actions will have access to all Config Vars, otherwise this will be undefined. */
  configVars?: Record<string, unknown>;
  /** A a flow-specific key/value store that may be used to store small amounts of data that is persisted between Instance executions */
  instanceState: Record<string, unknown>;
  /** A key/value store that is shared between flows on an Instance that may be used to store small amounts of data that is persisted between Instance executions */
  crossFlowState: Record<string, unknown>;
  /** A key/value store that may be used to store small amounts of data for use later during the execution */
  executionState: Record<string, unknown>;
  /** A key/value store that is shared between all flows of an Instance for any version of an Integration that may be used to store small amounts of data that is persisted between Instance executions */
  integrationState: Record<string, unknown>;
  /** A unique id that corresponds to the step on the Integration */
  stepId: string;
  /** A unique id that corresponds to the specific execution of the Integration */
  executionId: string;
  /** An object containing webhook URLs for all flows of the currently running instance */
  webhookUrls: Record<string, string>;
  /** An object containing webhook API keys for all flows of the currently running instance */
  webhookApiKeys: Record<string, string[]>;
  /** The URL used to invoke the current execution */
  invokeUrl: string;
  /** Contains attributes of the Customer for whom an Instance is being executed. */
  customer: CustomerAttributes;
  /** Contains attributes of the Instance that is being executed. */
  instance: InstanceAttributes;
  /** Contains attributes of the User for whom a User Level Configuration is being used. */
  user: UserAttributes;
  /** Contains attributes of the Integration that is being executed. */
  integration: IntegrationAttributes;
  /** Contains attributes of the Flow that is being executed. */
  flow: FlowAttributes;
  /** The time in UTC that execution started. */
  startedAt: string;
}
