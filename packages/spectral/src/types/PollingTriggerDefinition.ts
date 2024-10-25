import type {
  ActionDisplayDefinition,
  TriggerPerformFunction,
  TriggerEventFunction,
  Inputs,
  TriggerResult,
  ConfigVarResultCollection,
  TriggerPayload,
  ActionDefinition,
  ActionPerformReturn,
  ActionContext,
  ActionInputParameters,
} from ".";

export type PollingTriggerFilterableValue = Date | number;

export type PollingActionDefinition<
  TInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TReturn extends ActionPerformReturn<false, unknown> = ActionPerformReturn<false, unknown>,
> = ActionDefinition<TInputs, TConfigVars, false, TReturn>;

export type PollingTriggerFilterBy<TPollingAction extends ActionDefinition<any, any, any>> =
  TPollingAction extends ActionDefinition<
    any,
    any,
    false,
    ActionPerformReturn<false, infer TActionResult>
  >
    ? (
        resource: TActionResult extends any[] ? TActionResult[number] : TActionResult,
      ) => PollingTriggerFilterableValue
    : never;

export type PollingTriggerPayload = TriggerPayload & {
  body: {
    data: ActionPerformReturn<false, unknown>;
    contentType?: string;
  };
};

export type PollingTriggerResult<TPayload extends PollingTriggerPayload> = TriggerResult<
  false,
  TPayload
> & {
  comparisonValue: PollingTriggerFilterableValue;
};

export type PollingTriggerPerformFunction<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TPayload extends PollingTriggerPayload,
  TResult extends PollingTriggerResult<TPayload>,
> = (
  context: ActionContext<TConfigVars>,
  payload: TPayload,
  params: ActionInputParameters<TInputs>,
) => Promise<TResult>;

/**
 * PollingTriggerDefinition is the type of the object that is passed in to `pollingTrigger` function to
 * define a component trigger.
 */
export interface PollingTriggerDefinition<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TPayload extends PollingTriggerPayload,
  TResult extends PollingTriggerResult<TPayload>,
  TPollingAction extends PollingActionDefinition<Inputs, TConfigVars, any>,
> {
  /** Defines how the Trigger is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** The action that this trigger will poll with. */
  pollAction: {
    action: TPollingAction;
    inputMap?: Partial<{
      [K in keyof TPollingAction["inputs"]]: (context: any, payload: any, params: any) => unknown;
    }>;
    /** The return value of the filterBy will be used by polling trigger's default filter methods. If left blank, the response of the action will not be filtered. */
    filterBy?: PollingTriggerFilterBy<TPollingAction>;
  };
  /** Function to perform when this Trigger is invoked. A default perform will be provided for most polling triggers but defining this allows for custom behavior. */
  perform?: PollingTriggerPerformFunction<TInputs, TConfigVars, TPayload, TResult>;
  /** Function to execute when an Instance of an Integration with a Flow that uses this Trigger is deployed. */
  onInstanceDeploy?: TriggerEventFunction<TInputs, TConfigVars>;
  /** Function to execute when an Instance of an Integration with a Flow that uses this Trigger is deleted. */
  onInstanceDelete?: TriggerEventFunction<TInputs, TConfigVars>;
  /** InputFields to present in the Prismatic interface for configuration of this Trigger. */
  inputs?: TInputs;
}

export const isPollingTriggerDefinition = (
  ref: unknown,
): ref is PollingTriggerDefinition<
  Inputs,
  any,
  any,
  any,
  PollingActionDefinition<Inputs, any, any>
> => typeof ref === "object" && ref !== null && "pollAction" in ref;
