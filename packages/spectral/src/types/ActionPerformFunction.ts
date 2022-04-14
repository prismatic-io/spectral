import {
  Inputs,
  ActionPerformReturn,
  ActionInputParameters,
  ActionLogger,
} from ".";

/** Definition of the function to perform when an Action is invoked. */
export type ActionPerformFunction<
  TInputs extends Inputs,
  AllowsBranching extends boolean | undefined
> = (
  context: ActionContext,
  params: ActionInputParameters<TInputs>
) => Promise<ActionPerformReturn<AllowsBranching, unknown>>;

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
}
