/**
 * Trigger perform function types for server-side usage.
 * These are separate from the user-facing types in ../types to avoid circular dependencies.
 */

import type {
  ActionContext,
  ActionInputParameters,
  ConfigVarResultCollection,
  Inputs,
  TriggerPayload,
  TriggerResult,
} from "../types";

/** The result type after transforming a polling trigger result for the server. */
export type PollingTriggerServerResult<
  TAllowsBranching extends boolean,
  TPayload extends TriggerPayload,
> = Omit<NonNullable<TriggerResult<TAllowsBranching, TPayload>>, "polledNoChanges"> & {
  resultType: string;
};

/** The perform function type for CNI polling triggers that returns the server-expected format. */
export type CNIPollingPerformFunction<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
> = (
  context: ActionContext<TConfigVars>,
  payload: TPayload,
  params: ActionInputParameters<TInputs>,
) => Promise<PollingTriggerServerResult<TAllowsBranching, TPayload> | undefined>;

/** Server trigger result type - matches the non-generic TriggerResult from serverTypes/index.ts */
interface ServerTriggerBaseResult {
  payload: TriggerPayload;
  response?: {
    statusCode: number;
    contentType: string;
    headers?: Record<string, string>;
    body?: string;
  };
  instanceState?: Record<string, unknown>;
  crossFlowState?: Record<string, unknown>;
  executionState?: Record<string, unknown>;
  integrationState?: Record<string, unknown>;
  failed?: boolean;
  error?: Record<string, unknown>;
}

interface ServerTriggerBranchingResult extends ServerTriggerBaseResult {
  branch: string;
}

type ServerTriggerResult = ServerTriggerBranchingResult | ServerTriggerBaseResult | undefined;

/** Return type for component ref triggers - uses the server's TriggerResult since we delegate to invokeTrigger. */
export type ComponentRefTriggerPerformFunction<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
> = (
  context: ActionContext<TConfigVars>,
  payload: TriggerPayload,
  params: ActionInputParameters<TInputs>,
) => Promise<ServerTriggerResult>;
