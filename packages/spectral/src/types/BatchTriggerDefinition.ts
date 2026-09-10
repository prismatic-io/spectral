import type { ActionInputParameters } from "./ActionInputParameters";
import type { ActionContext } from "./ActionPerformFunction";
import type { ActionDisplayDefinition } from "./DisplayDefinition";
import type { HttpResponse } from "./HttpResponse";
import type { ConfigVarResultCollection, Inputs } from "./Inputs";
import type { BatchedTriggerPayload } from "./IntegrationDefinition";
import type { PollingState } from "./PollingTriggerDefinition";
import type { BatchConfig, TriggerOptionChoice } from "./TriggerDefinition";
import type { TriggerEventFunction } from "./TriggerEventFunction";
import type { TriggerPayload } from "./TriggerPayload";
import type { TriggerBaseResult } from "./TriggerResult";

/**
 * One page of records returned by a batched trigger's `perform`. Items are split into batches
 * of the flow's batch size, one execution per batch. A non-null `paginationState` fetches the
 * next page.
 */
export interface BatchTriggerBaseReturn<TItem, TPaginationState extends object = object> {
  /** The records on this page. Each execution receives one `TItem` at batch size 1, otherwise a `TItem[]`. */
  items: TItem[];
  /**
   * Cursor for the next page. The perform runs again with this value on
   * `payload.paginationState`. Omit or return `null` on the last page.
   */
  paginationState?: TPaginationState | null;
  /** Optional HTTP response to the request that invoked the trigger. */
  response?: HttpResponse;
  /**
   * Says whether the execution found anything. Return `true` when the page has no items and no
   * next cursor; the platform reads it from the first page only.
   */
  polledNoChanges?: boolean;
}

/** A page that also names the branch every execution from it follows. */
export interface BatchTriggerBranchingReturn<TItem, TPaginationState extends object = object>
  extends BatchTriggerBaseReturn<TItem, TPaginationState> {
  /** The branch every batch on this page takes. Branching is decided per page, not per item. */
  branch: string;
}

/** Return type of a batched trigger's `perform`, branching or not. */
export type BatchTriggerReturn<
  TAllowsBranching extends boolean,
  TItem,
  TPaginationState extends object = object,
> = TAllowsBranching extends true
  ? BatchTriggerBranchingReturn<TItem, TPaginationState>
  : BatchTriggerBaseReturn<TItem, TPaginationState>;

/**
 * The `perform` of a batched trigger. Receives the same `context`, `payload`, and `params` as a
 * plain trigger perform, with the previous page's cursor on `payload.paginationState` and
 * `context.polling` for state that carries between runs.
 *
 * Two kinds of state are in play. `paginationState` is the cursor for the next page and lives
 * for one run. `context.polling` holds a watermark across runs: read it with `getState` before
 * fetching and advance it with `setState`. Annotate `payload` as `TriggerPayload<YourCursor>`
 * to type the cursor.
 */
export type BatchTriggerPerformFunction<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TAllowsBranching extends boolean,
  TItem,
  TPaginationState extends object = object,
> = (
  context: ActionContext<TConfigVars> & { polling: PollingState },
  payload: TriggerPayload<TPaginationState>,
  params: ActionInputParameters<TInputs>,
) => Promise<BatchTriggerReturn<TAllowsBranching, TItem, TPaginationState>>;

/**
 * The initial sync a batched trigger runs when an instance is first deployed. Its `inputs` are
 * collected only for that sync and are passed, alongside the trigger's inputs, only to its
 * `perform`. Its cursor type is independent of the trigger's, so a webhook trigger with no
 * cursor can still page through its backfill.
 */
export interface BatchTriggerOnDeploy<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TAllowsBranching extends boolean,
  TItem,
  TOnDeployInputs extends Inputs = Inputs,
  TOnDeployPaginationState extends object = object,
> {
  /** Inputs collected only for the initial sync, such as a backfill start date. */
  inputs?: TOnDeployInputs;
  /** Fetches one page of the initial sync. Same shape as the trigger's `perform`. */
  perform: BatchTriggerPerformFunction<
    TInputs & TOnDeployInputs,
    TConfigVars,
    TAllowsBranching,
    TItem,
    TOnDeployPaginationState
  >;
}

/**
 * The object passed to `batchTrigger` to define a component trigger whose executions are
 * batched. Every flow that uses the trigger batches. The `perform` returns
 * `{ items, paginationState? }` in place of a full trigger result, and `batchTrigger` fills in
 * `triggerResolverSupport`, `synchronousResponseSupport`, and the resolver fields.
 */
export interface BatchTriggerDefinition<
  TInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TAllowsBranching extends boolean = boolean,
  TItem = unknown,
  TPaginationState extends object = object,
  TOnDeployInputs extends Inputs = Inputs,
  TOnDeployPaginationState extends object = object,
> {
  /** Defines how the trigger is displayed in the Prismatic UI. */
  display: ActionDisplayDefinition;
  /**
   * The inputs to present a low-code integration builder. Values of these inputs
   * are passed to the `perform` function when the trigger is invoked.
   */
  inputs: TInputs;
  /** Specifies whether this trigger supports executing the integration on a recurring schedule. */
  scheduleSupport: TriggerOptionChoice;
  /** Default batch size, and optional concurrent batch limit, for flows that use this trigger. A low-code builder may override it. */
  batchConfig: BatchConfig;
  /** Fetches one page of records. Runs again with the returned cursor on `payload.paginationState` until the cursor is `null`. Use `context.polling` for a watermark that carries between runs. */
  perform: BatchTriggerPerformFunction<
    TInputs,
    TConfigVars,
    TAllowsBranching,
    TItem,
    TPaginationState
  >;
  /** The initial sync run when an instance is first deployed. A flow opts in with `runInitialSyncOnDeploy`. */
  onDeploy?: BatchTriggerOnDeploy<
    TInputs,
    TConfigVars,
    TAllowsBranching,
    TItem,
    TOnDeployInputs,
    TOnDeployPaginationState
  >;
  /** Function to execute when an instance of an integration with a flow that uses this trigger is deployed. */
  onInstanceDeploy?: TriggerEventFunction<TInputs, TConfigVars>;
  /** Function to execute when an instance of an integration with a flow that uses this trigger is deleted. */
  onInstanceDelete?: TriggerEventFunction<TInputs, TConfigVars>;
  /** Optional webhook lifecycle handlers for create and delete operations. */
  webhookLifecycleHandlers?: {
    create: TriggerEventFunction<TInputs, TConfigVars>;
    delete: TriggerEventFunction<TInputs, TConfigVars>;
  };
  /** Attribute that specifies whether this Trigger will terminate execution. */
  terminateExecution?: boolean;
  /** Specifies whether an Action will break out of a loop. */
  breakLoop?: boolean;
  /** Determines whether this trigger supports branching. Each page picks the branch its batches follow. */
  allowsBranching?: TAllowsBranching;
  /** Static Branch names associated with this trigger. */
  staticBranchNames?: string[];
  /** The input field associated with dynamic branching. */
  dynamicBranchInput?: string;
  /** An example of the payload each execution receives. `body.data` holds one item or an array of items, depending on the flow's batch size. */
  examplePayload?: TriggerBaseResult<
    BatchedTriggerPayload<TriggerPayload<TPaginationState>, TItem>
  >;
  /**
   * Specifies if this trigger appears in the list of 'common' triggers. Only configurable by Prismatic.
   * @default false
   */
  isCommonTrigger?: boolean;
  /** Set to `"invalid"` by `batchTrigger`: a batched trigger runs asynchronously. */
  synchronousResponseSupport?: never;
  /** Set to `"required"` by `batchTrigger`: every flow that uses a batched trigger batches. */
  triggerResolverSupport?: never;
  /** Derived by `batchTrigger` from `perform`'s return. */
  triggerResolver?: never;
  /** Define the initial sync at `onDeploy.perform`. */
  onDeployPerform?: never;
  /** Derived by `batchTrigger` from `onDeploy.perform`'s return. */
  onDeployResolver?: never;
}
