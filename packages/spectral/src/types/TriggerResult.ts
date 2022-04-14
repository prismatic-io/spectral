import { TriggerPayload } from "./TriggerPayload";
import { HttpResponse } from "./HttpResponse";

/** Represents the result of a Trigger action. */
export interface TriggerBaseResult {
  /** The payload in the request that invoked the Integration, which is returned as a result for later use. */
  payload: TriggerPayload;
  /** Optional HTTP response to the request that invoked the integration. */
  response?: HttpResponse;
  /** An optional object, the keys and values of which will be persisted in the flow-specific instanceState and available for subsequent actions and executions */
  instanceState?: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the crossFlowState and available in any flow for subsequent actions and executions */
  crossFlowState: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the executionState and available for the duration of the execution */
  executionState?: Record<string, unknown>;
}

/** Represents the result of a Trigger action that uses branching. */
export interface TriggerBranchingResult extends TriggerBaseResult {
  /** Name of the Branch to take. */
  branch: string;
}

/** Required return type of all trigger perform functions */
export type TriggerResult<AllowsBranching extends boolean | undefined> =
  | (AllowsBranching extends true ? TriggerBranchingResult : TriggerBaseResult)
  | undefined;
