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
 */
export type TriggerResolverDecl<
  TConfigVars extends ConfigVarResultCollection,
  TPayload extends TriggerPayload,
> =
  | { triggerResolverSupport?: "invalid" | undefined; triggerResolver?: undefined }
  | {
      triggerResolverSupport: "valid";
      triggerResolver?: TriggerResolver<TConfigVars, TPayload>;
    }
  | {
      triggerResolverSupport: "required";
      triggerResolver: TriggerResolver<TConfigVars, TPayload>;
    };

const optionChoices = ["invalid", "valid", "required"] as const;

export type TriggerOptionChoice = (typeof optionChoices)[number];

export const TriggerOptionChoices: TriggerOptionChoice[] = [...optionChoices];

export interface TriggerResolver<
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TItem = unknown,
> {
  /** Author-declared defaults for how this trigger's items are batched. */
  default: {
    /** Number of items per batch. Must be an integer >= 1. `1` dispatches each item individually; `>1` groups items into batches. */
    batchSize: number;
  };
  /** Extracts an array of items from the trigger result for batched dispatch. Receives the same context as the trigger's perform function. */
  resolveItems?: (
    context: ActionContext<TConfigVars>,
    result: TriggerBaseResult<TPayload>,
  ) => TItem[];
  /** Extracts data from the trigger result to be passed to the next trigger invocation to fetch another page of data. */
  getNextDiscoveryState?: (
    context: ActionContext<TConfigVars>,
    result: TriggerBaseResult<TPayload>,
  ) => Record<string, unknown> | null;
}

/**
 * TriggerDefinition is the type of the object that is passed in to `trigger` function to
 * define a component trigger. See
 * https://prismatic.io/docs/custom-connectors/triggers/
 *
 * Composed from `TriggerDefinitionBase` (static fields) plus the discriminated union
 * `TriggerResolverDecl`, which enforces the resolver support relationship at the type
 * level.
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
  TriggerResolverDecl<TConfigVars, TriggerPayload>;

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
