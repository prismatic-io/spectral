import type { ActionContext } from "./ActionPerformFunction";
import type { ActionDisplayDefinition } from "./DisplayDefinition";
import type { ConfigVarResultCollection, Inputs } from "./Inputs";
import type { TriggerEventFunction } from "./TriggerEventFunction";
import type { TriggerPayload } from "./TriggerPayload";
import type { TriggerPerformFunction } from "./TriggerPerformFunction";
import type { TriggerBaseResult, TriggerResult } from "./TriggerResult";

/**
 * Encodes the relationship between `triggerResolverSupport` and `triggerResolver`:
 * - absent or `"invalid"`: no resolver allowed
 * - `"valid"`: resolver optional
 * - `"required"`: resolver required
 *
 * `triggerResolver` is the resolver *behavior* only; batch sizing comes from the
 * trigger's shared `batchConfig` (see `TriggerDefinition`).
 */
export type TriggerResolverDecl<
  TConfigVars extends ConfigVarResultCollection,
  TPayload extends TriggerPayload,
  TItem = unknown,
  TDiscoveryState extends Record<string, unknown> = Record<string, unknown>,
> =
  | { triggerResolverSupport?: "invalid" | undefined; triggerResolver?: undefined }
  | {
      triggerResolverSupport: "valid";
      triggerResolver?: TriggerResolverBehavior<TConfigVars, TPayload, TItem, TDiscoveryState>;
    }
  | {
      triggerResolverSupport: "required";
      triggerResolver: TriggerResolverBehavior<TConfigVars, TPayload, TItem, TDiscoveryState>;
    };

/**
 * Encodes the relationship between `onDeployPerform` and `onDeployResolver`. On-deploy is
 * presence-driven — there is no separate support flag: a trigger fires on deploy if it
 * defines `onDeployPerform`, and batches that fire if it also defines an `onDeployResolver`.
 * An `onDeployResolver` therefore requires an `onDeployPerform`.
 *
 * `onDeployPerform` is the component-trigger sibling to `perform`. A CNI flow names the
 * same on-deploy fire `onDeployTrigger` (sibling to its `onTrigger`); both flatten to
 * `onDeployPerform` on the wire.
 */
export type OnDeployDecl<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TPayload extends TriggerPayload,
  TAllowsBranching extends boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload>,
  TItem = unknown,
  TDiscoveryState extends Record<string, unknown> = Record<string, unknown>,
> =
  | { onDeployPerform?: undefined; onDeployResolver?: undefined }
  | {
      onDeployPerform: TriggerPerformFunction<TInputs, TConfigVars, TAllowsBranching, TResult>;
      onDeployResolver?: TriggerResolverBehavior<TConfigVars, TPayload, TItem, TDiscoveryState>;
    };

const optionChoices = ["invalid", "valid", "required"] as const;

export type TriggerOptionChoice = (typeof optionChoices)[number];

export const TriggerOptionChoices: TriggerOptionChoice[] = [...optionChoices];

/**
 * The batching/pagination behavior shared by every resolver surface — component
 * triggers (`TriggerResolver`), CNI flows (`TriggerResolverConfig`), and the
 * on-deploy variants. Defining it once keeps the contract from drifting across
 * those surfaces.
 *
 * The two type variables ARE the data that flows through the batch chain:
 *
 *   perform ──▶ resolveItems ──▶ [batch of TItem] ──▶ onExecution
 *                    │
 *                    └─ getNextDiscoveryState ──▶ payload.discoveryState ──▶ next perform
 *
 * @typeParam TItem - element produced by `resolveItems`. With `batchSize: 1`
 *   each execution receives one `TItem` as its trigger data; with `batchSize > 1`
 *   it receives a `TItem[]` slice.
 * @typeParam TDiscoveryState - the pagination cursor. Whatever
 *   `getNextDiscoveryState` returns is what the next round reads back on
 *   `payload.discoveryState` (see {@link TriggerPayload}). The `result.payload`
 *   passed to both callbacks has its `discoveryState` narrowed to this type, so
 *   the cursor round-trip is checked end to end.
 */
export interface TriggerResolverBehavior<
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TItem = unknown,
  TDiscoveryState extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Extracts the items to dispatch from one trigger result. Receives the same context as the trigger's perform function. With `batchSize: 1` each item is delivered to its own execution; with `batchSize > 1` items are grouped into `TItem[]` slices. */
  resolveItems?: (
    context: ActionContext<TConfigVars>,
    result: TriggerBaseResult<WithDiscoveryState<TPayload, TDiscoveryState>>,
  ) => TItem[];
  /** Returns the cursor for the next page, or `null` to stop. A non-null return re-invokes the trigger with this object stamped onto `payload.discoveryState`. */
  getNextDiscoveryState?: (
    context: ActionContext<TConfigVars>,
    result: TriggerBaseResult<WithDiscoveryState<TPayload, TDiscoveryState>>,
  ) => TDiscoveryState | null;
}

/**
 * A trigger payload with its `discoveryState` field narrowed to `TDiscoveryState`,
 * leaving every other field of `TPayload` intact. Lets a resolver type the cursor
 * it reads back independently of how the base payload was parameterized.
 */
export type WithDiscoveryState<
  TPayload extends TriggerPayload,
  TDiscoveryState extends Record<string, unknown>,
> = Omit<TPayload, "discoveryState"> & { discoveryState?: TDiscoveryState };

/**
 * The single batch-dispatch config shared by a trigger's `triggerResolver` and
 * `onDeployResolver` — they always batch the same way. One place for batch settings.
 *
 * On a CNI flow (`flow.batchConfig`) this value is authoritative. On a component trigger
 * (`TriggerDefinition.batchConfig`) it's the default the platform seeds, which a low-code
 * user may override per instance.
 */
export interface BatchConfig {
  /** Number of items per batch. Must be an integer >= 1. `1` dispatches each item individually; `>1` groups items into batches. */
  batchSize: number;
  /** Max batches of a single execution dispatched concurrently. Must be an integer >= 1 when set. Omit for unlimited. */
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
> = TriggerDefinitionBase<TInputs, TConfigVars, TAllowsBranching, TResult> &
  TriggerResolverDecl<TConfigVars, TriggerPayload> &
  OnDeployDecl<TInputs, TConfigVars, TriggerPayload, TAllowsBranching, TResult>;

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
   * Default batch-dispatch config shared by `triggerResolver` and `onDeployResolver`.
   * Required when this trigger declares either (a `triggerResolver` with
   * `triggerResolverSupport` `"valid"`/`"required"`, or an `onDeployResolver`).
   */
  batchConfig?: BatchConfig;
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
