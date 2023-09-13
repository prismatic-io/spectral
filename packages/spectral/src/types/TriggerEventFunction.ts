import { Inputs, ActionContext, ActionInputParameters } from ".";

export type TriggerEventFunctionReturn = {
  /** An optional object, the keys and values of which will be persisted in the flow-specific instanceState and available for subsequent actions and executions */
  instanceState?: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the crossFlowState and available in any flow for subsequent actions and executions */
  crossFlowState?: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the executionState and available for the duration of the execution */
  executionState?: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the integrationState and available in any flow of an Instance for any version of an Integration for subsequent actions and executions */
  integrationState?: Record<string, unknown>;
};

/** Definition of the function to execute when a Trigger Event occurs. */
export type TriggerEventFunction<TInputs extends Inputs> = (
  context: ActionContext,
  params: ActionInputParameters<TInputs>
) => Promise<void | TriggerEventFunctionReturn>;
