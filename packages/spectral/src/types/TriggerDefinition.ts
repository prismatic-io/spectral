import type { ActionContext } from "./ActionPerformFunction";
import type { ActionDisplayDefinition } from "./DisplayDefinition";
import type { ConfigVarResultCollection, Inputs } from "./Inputs";
import type { TriggerEventFunction } from "./TriggerEventFunction";
import type { TriggerPayload } from "./TriggerPayload";
import type { TriggerPerformFunction } from "./TriggerPerformFunction";
import type { TriggerBaseResult, TriggerResult } from "./TriggerResult";

/**
 * Encodes the relationship between `triggerResolverSupport`, `triggerResolver`, and `batchConfig`:
 * - absent or `"invalid"`: no resolver
 * - `"valid"`: resolver optional; `batchConfig` required
 * - `"required"`: resolver and `batchConfig` required
 *
 * `triggerResolver` holds the resolver behavior only. Any trigger a flow can batch declares its
 * default batch size in `batchConfig`, checked at author time.
 */
export type TriggerResolverDecl<
  TConfigVars extends ConfigVarResultCollection,
  TPayload extends TriggerPayload,
  TItem = unknown,
  TPaginationState extends object = object,
> =
  | {
      triggerResolverSupport?: "invalid" | undefined;
      triggerResolver?: undefined;
      batchConfig?: BatchConfig;
    }
  | { triggerResolverSupport: "valid"; triggerResolver?: undefined; batchConfig: BatchConfig }
  | {
      triggerResolverSupport: "valid";
      triggerResolver: TriggerResolverBehavior<TConfigVars, TPayload, TItem, TPaginationState>;
      batchConfig: BatchConfig;
    }
  | {
      triggerResolverSupport: "required";
      triggerResolver: TriggerResolverBehavior<TConfigVars, TPayload, TItem, TPaginationState>;
      batchConfig: BatchConfig;
    };

/**
 * The on-deploy resolver: the shared resolver behavior plus optional `inputs` collected only
 * when a flow runs its initial sync on deploy, such as a backfill start date. They are declared
 * separately from the trigger's `inputs` and reach only `onDeployPerform`'s params.
 */
export interface OnDeployResolverBehavior<
  TOnDeployInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TItem = unknown,
  TPaginationState extends object = object,
> extends TriggerResolverBehavior<TConfigVars, TPayload, TItem, TPaginationState> {
  /** Inputs collected only when the flow runs its initial sync on deploy. Passed to `onDeployPerform` alongside the trigger's inputs. */
  inputs?: TOnDeployInputs;
}

/**
 * Encodes the relationship between `onDeployPerform` and `onDeployResolver`. A trigger runs an
 * initial sync on deploy when it defines `onDeployPerform`, and batches that sync when it also
 * defines `onDeployResolver`, which therefore requires `onDeployPerform`.
 *
 * `onDeployPerform` is the component-trigger counterpart of a CNI flow's `onDeployTrigger`.
 * Its params merge the trigger's `TInputs` with the on-deploy resolver's `TOnDeployInputs`.
 */
export type OnDeployDecl<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TPayload extends TriggerPayload,
  TAllowsBranching extends boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload>,
  TItem = unknown,
  TPaginationState extends object = object,
  TOnDeployInputs extends Inputs = Inputs,
> =
  | { onDeployPerform?: undefined; onDeployResolver?: undefined; batchConfig?: BatchConfig }
  | {
      onDeployPerform: TriggerPerformFunction<
        TInputs & TOnDeployInputs,
        TConfigVars,
        TAllowsBranching,
        TResult
      >;
      onDeployResolver?: undefined;
      batchConfig?: BatchConfig;
    }
  | {
      onDeployPerform: TriggerPerformFunction<
        TInputs & TOnDeployInputs,
        TConfigVars,
        TAllowsBranching,
        TResult
      >;
      onDeployResolver: OnDeployResolverBehavior<
        TOnDeployInputs,
        TConfigVars,
        TPayload,
        TItem,
        TPaginationState
      >;
      batchConfig: BatchConfig;
    };

const optionChoices = ["invalid", "valid", "required"] as const;

export type TriggerOptionChoice = (typeof optionChoices)[number];

export const TriggerOptionChoices: TriggerOptionChoice[] = [...optionChoices];

/**
 * The batching and pagination behavior shared by a component trigger's `triggerResolver` and
 * `onDeployResolver`.
 *
 * The two type variables are the data that flows through the batch chain:
 *
 *   perform ──▶ resolveItems ──▶ [batch of TItem] ──▶ onExecution
 *                    │
 *                    └─ getNextPaginationState ──▶ payload.paginationState ──▶ next perform
 *
 * @typeParam TItem - element produced by `resolveItems`. With `batchSize: 1`
 *   each execution receives one `TItem` as its trigger data; with `batchSize > 1`
 *   it receives a `TItem[]` slice.
 * @typeParam TPaginationState - the pagination cursor. Whatever
 *   `getNextPaginationState` returns is what the next round reads back on
 *   `payload.paginationState` (see {@link TriggerPayload}). The `result.payload`
 *   passed to both callbacks has its `paginationState` narrowed to this type, so
 *   the cursor round-trip is checked end to end.
 */
export interface TriggerResolverBehavior<
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TItem = unknown,
  TPaginationState extends object = object,
> {
  /** Extracts the items to dispatch from one trigger result. Receives the same context as the trigger's `perform`. With `batchSize: 1` each item gets its own execution; with `batchSize > 1` items are grouped into `TItem[]` batches. */
  resolveItems?: (
    context: ActionContext<TConfigVars>,
    result: TriggerBaseResult<WithPaginationState<TPayload, TPaginationState>>,
  ) => TItem[];
  /** Returns the cursor for the next page, or `null` on the last page. A non-null cursor runs the trigger again with it on `payload.paginationState`. */
  getNextPaginationState?: (
    context: ActionContext<TConfigVars>,
    result: TriggerBaseResult<WithPaginationState<TPayload, TPaginationState>>,
  ) => TPaginationState | null;
}

/**
 * A trigger payload with its `paginationState` field narrowed to `TPaginationState`,
 * leaving every other field of `TPayload` intact. Lets a resolver type the cursor
 * it reads back independently of how the base payload was parameterized.
 */
export type WithPaginationState<
  TPayload extends TriggerPayload,
  TPaginationState extends object,
> = Omit<TPayload, "paginationState"> & { paginationState?: TPaginationState };

/**
 * Batch settings shared by a trigger's `triggerResolver` and `onDeployResolver`. On a CNI flow
 * (`flow.batchConfig`) the value applies as written. On a component trigger
 * (`TriggerDefinition.batchConfig`) it is the default, which a low-code builder may override.
 */
export interface BatchConfig {
  /** Number of items per batch. Must be an integer >= 1. `1` gives each item its own execution; `>1` groups items into batches. */
  batchSize: number;
  /** Maximum number of batches from one trigger run processed concurrently. Must be an integer >= 1 when set. Omit for unlimited. */
  concurrentBatchLimit?: number;
}

/**
 * TriggerDefinition is the type of the object that is passed in to `trigger` function to
 * define a component trigger. See
 * https://prismatic.io/docs/custom-connectors/triggers/
 *
 * Composed from `TriggerDefinitionBase` (static fields) plus `TriggerResolverDecl` (the
 * resolver support relationship) and `OnDeployDecl` (the on-deploy perform/resolver
 * relationship), which enforce those constraints at the type level.
 */
export type TriggerDefinition<
  TInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TriggerPayload> = TriggerResult<
    TAllowsBranching,
    TriggerPayload
  >,
  TOnDeployInputs extends Inputs = Inputs,
> = TriggerDefinitionBase<TInputs, TConfigVars, TAllowsBranching, TResult> &
  TriggerResolverDecl<TConfigVars, TriggerPayload> &
  OnDeployDecl<
    TInputs,
    TConfigVars,
    TriggerPayload,
    TAllowsBranching,
    TResult,
    unknown,
    object,
    TOnDeployInputs
  >;

interface TriggerDefinitionBase<
  TInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TriggerPayload> = TriggerResult<
    TAllowsBranching,
    TriggerPayload
  >,
> {
  /** Defines how the trigger is displayed in the Prismatic UI. */
  display: ActionDisplayDefinition;
  /** Function to perform when this trigger is invoked. */
  perform: TriggerPerformFunction<TInputs, TConfigVars, TAllowsBranching, TResult>;
  /**
   * Function to execute when an instance of an integration with a flow that uses this trigger is deployed. See
   * https://prismatic.io/docs/custom-connectors/triggers/#instance-deploy-and-delete-events-for-triggers
   */
  onInstanceDeploy?: TriggerEventFunction<TInputs, TConfigVars>;
  /** Function to execute when an instance of an integration with a flow that uses this trigger is deleted. See
   * https://prismatic.io/docs/custom-connectors/triggers/#instance-deploy-and-delete-events-for-triggers
   */
  onInstanceDelete?: TriggerEventFunction<TInputs, TConfigVars>;
  /** Optional webhook lifecycle handlers for create, read, and delete operations. */
  webhookLifecycleHandlers?: {
    /** Function to execute to configure a webhook. */
    create: TriggerEventFunction<TInputs, TConfigVars>;
    /** Function to execute for webhook teardown. */
    delete: TriggerEventFunction<TInputs, TConfigVars>;
  };
  /**
   * The inputs to present a low-code integration builder. Values of these inputs
   * are passed to the `perform` function when the trigger is invoked.
   */
  inputs: TInputs;
  /** Specifies whether this trigger supports executing the integration on a recurring schedule. */
  scheduleSupport: TriggerOptionChoice;
  /** Specifies whether this trigger supports synchronous responses to a webhook request. */
  synchronousResponseSupport: TriggerOptionChoice;
  /** Attribute that specifies whether this Trigger will terminate execution. */
  terminateExecution?: boolean;
  /** Specifies whether an Action will break out of a loop. */
  breakLoop?: boolean;
  /**
   * Determines whether this trigger supports branching. See
   * https://prismatic.io/docs/custom-connectors/branching/
   */
  allowsBranching?: TAllowsBranching;
  /** Static Branch names associated with this trigger. */
  staticBranchNames?: string[];
  /** The input field associated with dynamic branching. */
  dynamicBranchInput?: string;
  /** An example of the payload outputted by this trigger. */
  examplePayload?: Awaited<ReturnType<this["perform"]>>;
  /**
   * Specifies if this trigger appears in the list of 'common' triggers. Only configurable by Prismatic.
   * @default false
   */
  isCommonTrigger?: boolean;
}
