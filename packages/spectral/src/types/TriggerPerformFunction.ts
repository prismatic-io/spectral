import {
  Inputs,
  TriggerResult,
  ActionInputParameters,
  ActionContext,
  TriggerPayload,
} from ".";

/** Definition of the function to perform when a Trigger is invoked. */
export type TriggerPerformFunction<
  T extends Inputs,
  TAllowsBranching extends boolean | undefined,
  TResult extends TriggerResult<TAllowsBranching>
> = (
  context: ActionContext,
  payload: TriggerPayload,
  params: ActionInputParameters<T>
) => Promise<TResult>;
