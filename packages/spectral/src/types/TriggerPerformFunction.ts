import type { ActionInputParameters } from "./ActionInputParameters";
import type { ActionContext } from "./ActionPerformFunction";
import type { ConfigVarResultCollection, Inputs } from "./Inputs";
import type { TriggerPayload } from "./TriggerPayload";
import type { TriggerResult } from "./TriggerResult";

/** Definition of the function to perform when a Trigger is invoked. */
export type TriggerPerformFunction<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TAllowsBranching extends boolean | undefined,
  TResult extends TriggerResult<TAllowsBranching, TriggerPayload>,
  TDiscoveryState extends Record<string, unknown> = Record<string, unknown>,
> = (
  context: ActionContext<TConfigVars>,
  payload: TriggerPayload<TDiscoveryState>,
  params: ActionInputParameters<TInputs>,
) => Promise<TResult>;
