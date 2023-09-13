import { Inputs, ActionContext, ActionInputParameters } from ".";

/** Definition of the function to execute when a Trigger Event occurs. */
export type TriggerEventFunction<TInputs extends Inputs> = (
  context: ActionContext,
  params: ActionInputParameters<TInputs>
) => Promise<void>;
