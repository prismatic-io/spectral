import type { AxiosRequestConfig, AxiosResponse } from "axios";
import type {
  ActionDisplayDefinition,
  TriggerEventFunction,
  Inputs,
  ConfigVarResultCollection,
  TriggerPayload,
  ActionDefinition,
  ActionContext,
  ActionInputParameters,
  ActionPerformReturn,
  TriggerResult,
} from ".";

export interface PollingContext<
  TInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
> extends ActionContext<TConfigVars> {
  polling: {
    reinvokeFlow: (
      data?: Record<string, unknown>,
      config?: AxiosRequestConfig<any>,
    ) => Promise<AxiosResponse<any, any>>;
    invokeAction: (
      params: ActionInputParameters<TInputs>,
    ) => Promise<ActionPerformReturn<boolean, any>>;
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
 */
export interface PollingTriggerDefinition<
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
