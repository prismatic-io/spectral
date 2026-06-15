import type { ActionDefinition } from "./ActionDefinition";
import type { ActionInputParameters } from "./ActionInputParameters";
import type { ActionContext } from "./ActionPerformFunction";
import type { ActionPerformReturn } from "./ActionPerformReturn";
import type { ActionDisplayDefinition } from "./DisplayDefinition";
import type { ConfigVarResultCollection, Inputs } from "./Inputs";
import type { BatchConfig, OnDeployDecl, TriggerResolverDecl } from "./TriggerDefinition";
import type { TriggerEventFunction } from "./TriggerEventFunction";
import type { TriggerPayload } from "./TriggerPayload";
import type { TriggerResult } from "./TriggerResult";

export interface PollingContext<
  TInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  ReturnData = unknown,
> extends ActionContext<TConfigVars> {
  polling: {
    invokeAction: (
      params: ActionInputParameters<TInputs>,
    ) => Promise<ActionPerformReturn<boolean, ReturnData>>;
    getState: () => Record<string, unknown>;
    setState: (newState: Record<string, unknown>) => void;
  };
}

export type PollingTriggerPerformFunction<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
> = (
  context: ActionContext<TConfigVars> & PollingContext<TActionInputs>,
  payload: TPayload,
  params: ActionInputParameters<TInputs>,
) => Promise<TResult>;

/**
 * PollingTriggerDefinition is the type of the object that is passed in to `pollingTrigger` function to
 * define a component trigger.
 *
 * Composed from `PollingTriggerDefinitionBase` plus `TriggerResolverDecl` (resolver support)
 * and `OnDeployDecl` (the on-deploy perform/resolver relationship), enforced at the type level.
 */
export type PollingTriggerDefinition<
  TInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
  TActionInputs extends Inputs = Inputs,
  TAction extends ActionDefinition<TActionInputs> = ActionDefinition<TActionInputs>,
  TCombinedInputs extends TInputs & TActionInputs = TInputs & TActionInputs,
> = PollingTriggerDefinitionBase<
  TInputs,
  TConfigVars,
  TPayload,
  TAllowsBranching,
  TResult,
  TActionInputs,
  TAction,
  TCombinedInputs
> &
  TriggerResolverDecl<TConfigVars, TPayload> &
  OnDeployDecl<TInputs, TConfigVars, TPayload, TAllowsBranching, TResult>;

interface PollingTriggerDefinitionBase<
  TInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
  TActionInputs extends Inputs = Inputs,
  TAction extends ActionDefinition<TActionInputs> = ActionDefinition<TActionInputs>,
  TCombinedInputs extends TInputs & TActionInputs = TInputs & TActionInputs,
> {
  triggerType?: "polling";
  /** Defines how the Action is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /**
   * Default batch-dispatch config for this trigger's resolvers — a single config shared
   * by `triggerResolver` and `onDeployResolver`. Required when this trigger declares a
   * `triggerResolver` (`triggerResolverSupport` `"valid"`/`"required"`) or an `onDeployResolver`.
   */
  batchConfig?: BatchConfig;
  /** Defines your trigger's polling behavior. */
  pollAction?: TAction;
  /** Function to perform when this Trigger is invoked. A default perform will be provided for most polling triggers but defining this allows for custom behavior. */
  perform: PollingTriggerPerformFunction<
    TCombinedInputs,
    TActionInputs,
    TConfigVars,
    TPayload,
    TAllowsBranching,
    TResult
  >;
  /** Function to execute when an Instance of an Integration with a Flow that uses this Trigger is deployed. */
  onInstanceDeploy?: TriggerEventFunction<TInputs, TConfigVars>;
  /** Function to execute when an Instance of an Integration with a Flow that uses this Trigger is deleted. */
  onInstanceDelete?: TriggerEventFunction<TInputs, TConfigVars>;
  /** InputFields to present in the Prismatic interface for configuration of this Trigger. */
  inputs?: TInputs;
  /** Determines whether this Trigger allows Conditional Branching. */
  allowsBranching?: TAllowsBranching;
  /** An example of the payload outputted by this Trigger. */
  examplePayload?: Awaited<ReturnType<this["perform"]>>;
}

export const isPollingTriggerDefinition = (ref: unknown): ref is PollingTriggerDefinition =>
  typeof ref === "object" && ref !== null && "triggerType" in ref && ref.triggerType === "polling";
