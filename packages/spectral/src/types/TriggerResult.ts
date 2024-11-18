import { TriggerPayload } from "./TriggerPayload";
import { HttpResponse } from "./HttpResponse";

export type TriggerResultType = "completed" | "polled_no_changes";

/** Represents the result of a Trigger action. */
export interface TriggerBaseResult<TPayload extends TriggerPayload> {
  /** The payload in the request that invoked the Integration, which is returned as a result for later use. */
  payload: TPayload;
  /** Optional HTTP response to the request that invoked the integration. */
  response?: HttpResponse;
  /** An optional object, the keys and values of which will be persisted in the flow-specific instanceState and available for subsequent actions and executions */
  instanceState?: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the crossFlowState and available in any flow for subsequent actions and executions */
  crossFlowState?: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the executionState and available for the duration of the execution */
  executionState?: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the integrationState and available in any flow of an Instance for any version of an Integration for subsequent actions and executions */
  integrationState?: Record<string, unknown>;
  /** A field populated by the Prismatic platform which indicates whether the trigger failed with an error during execution. */
  failed?: boolean;
  /** A field populated by the Prismatic platform which may refer to an object that contains data about any error that resulted in failure. */
  error?: Record<string, unknown>;
  /** A field populated by the Prismatic platform which labels the trigger's return type. */
  returnType?: TriggerResultType;
  /** An optional field that component authors can use to denote their CNI trigger result as having a polling response. */
  polledNoChanges?: boolean;
}

/** Represents the result of a Trigger action that uses branching. */
export interface TriggerBranchingResult<TPayload extends TriggerPayload>
  extends TriggerBaseResult<TPayload> {
  /** Name of the Branch to take. */
  branch: string;
}

/** Required return type of all trigger perform functions */
export type TriggerResult<
  AllowsBranching extends boolean | undefined,
  TPayload extends TriggerPayload,
> =
  | (AllowsBranching extends true ? TriggerBranchingResult<TPayload> : TriggerBaseResult<TPayload>)
  | undefined;
