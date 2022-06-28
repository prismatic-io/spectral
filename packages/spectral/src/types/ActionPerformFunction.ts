import {
  Inputs,
  ActionPerformReturn,
  ActionInputParameters,
  ActionLogger,
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
  /** A a flow-specific key/value store that may be used to store small amounts of data that is persisted between Instance executions */
  instanceState: Record<string, unknown>;
  /** An key/value store what is shared between flows on an Instance that may be used to store small amounts of data that is persisted between Instance executions */
  crossFlowState: Record<string, unknown>;
  /** A key/value store that may be used to store small amounts of data for use later during the execution */
  executionState: Record<string, unknown>;
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
  /** An object containing the ID, External ID and name of the customer the instance is deployed to */
  customer: {
    id: string | null;
    externalId: string | null;
    name: string | null;
  };
  /** An object containing the ID ad name of the currently running instance */
  instance: {
    id: string | null;
    name: string | null;
  };
}
