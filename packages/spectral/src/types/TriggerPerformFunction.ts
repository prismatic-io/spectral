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
  AllowsBranching extends boolean,
  Result extends TriggerResult<AllowsBranching>
> = (
  context: ActionContext,
  payload: TriggerPayload,
  params: ActionInputParameters<T>
) => Promise<Result>;
