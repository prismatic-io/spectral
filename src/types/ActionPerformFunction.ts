import {
  Credential,
  Inputs,
  PerformReturn,
  ActionInputParameters,
  ActionLogger,
} from ".";

/** Definition of the function to perform when an Action is invoked. */
export type ActionPerformFunction<
  T extends Inputs,
  AllowsBranching extends boolean,
  ReturnData extends PerformReturn<AllowsBranching, unknown>
> = (
  context: ActionContext,
  params: ActionInputParameters<T>
) => Promise<ReturnData>;

/** Context provided to perform method containing helpers and contextual data */
export interface ActionContext {
  /** Credential for the action, optional since not all actions will require a credential */
  credential?: Credential;
  /** Logger for permanent logging; console calls are also captured */
  logger: ActionLogger;
  /** A key/value store that may be used to store small amounts of data that is persisted between Instance executions */
  instanceState: Record<string, unknown>;
  /** A unique id that corresponds to the step on the Integration */
  stepId: string;
}
