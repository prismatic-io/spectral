import {
  Inputs,
  TriggerResult,
  ActionInputParameters,
  ActionContext,
  TriggerPayload,
  ConfigVarResultCollection,
} from ".";

/** Definition of the function to perform when a Trigger is invoked. */
export type TriggerPerformFunction<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  THasConfigVars extends boolean,
  TAllowsBranching extends boolean | undefined,
  TResult extends TriggerResult<TAllowsBranching, TriggerPayload>
> = (
  context: ActionContext<TConfigVars, THasConfigVars>,
  payload: TriggerPayload,
  params: ActionInputParameters<TInputs>
) => Promise<TResult>;
