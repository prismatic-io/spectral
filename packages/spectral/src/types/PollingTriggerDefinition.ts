import type {
  ActionDisplayDefinition,
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

export type PollingTriggerPerformPayload = TriggerPayload & {
  body: {
    data: {
      actionResponse: ActionPerformReturn<false, unknown>;
      pollComparisonValue: PollingTriggerFilterableValue;
    };
    contentType?: string;
  };
};

export type PollingTriggerResult<TPayload extends TriggerPayload> = TriggerResult<
  false,
  TPayload
> & {
  pollComparisonValue: PollingTriggerFilterableValue;
};

export type PollingTriggerPerformFunction<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TPerformPayload extends PollingTriggerPerformPayload,
  TPayload extends TriggerPayload,
  TResult extends PollingTriggerResult<TPayload>,
> = (
  context: ActionContext<TConfigVars>,
  payload: TPerformPayload,
  params: ActionInputParameters<TInputs>,
) => Promise<TResult>;

/**
 * PollingTriggerDefinition is the type of the object that is passed in to `pollingTrigger` function to
 * define a component trigger.
 */
export type PollingTriggerDefinition<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TPayload extends TriggerPayload,
  TResult extends PollingTriggerResult<TPayload>,
  TPerformPayload extends PollingTriggerPerformPayload,
  TPollingAction extends PollingActionDefinition<Inputs, TConfigVars, any>,
> =
  | PollingTriggerDefaultDefinition<TInputs, TConfigVars, TPollingAction>
  | PollingTriggerCustomDefinition<
      TInputs,
      TConfigVars,
      TPayload,
      TResult,
      TPerformPayload,
      TPollingAction
    >;

interface PollingTriggerBaseDefinition<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
> {
  /** Defines how the Trigger is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** Function to execute when an Instance of an Integration with a Flow that uses this Trigger is deployed. */
  onInstanceDeploy?: TriggerEventFunction<TInputs, TConfigVars>;
  /** Function to execute when an Instance of an Integration with a Flow that uses this Trigger is deleted. */
  onInstanceDelete?: TriggerEventFunction<TInputs, TConfigVars>;
  /** Enables schedule input in the designer. */
  scheduleSupport?: "valid";
}
export type PollingTriggerDefaultDefinition<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TPollingAction extends PollingActionDefinition<Inputs, TConfigVars, any>,
> = PollingTriggerBaseDefinition<TInputs, TConfigVars> & {
  /** Defines your trigger's polling behavior. */
  pollAction: {
    /** The action that this trigger will be running every poll. */
    action: TPollingAction;
    /** Defining this map will allow you to pipe through values from the trigger context, payload, or params, through to the action inputs. */
    inputMap?: Partial<{
      [K in keyof TPollingAction["inputs"]]: (context: any, payload: any, params: any) => unknown;
    }>;
    /** getResults takes the result of the polling action and should return the results to be iterated over. By default this will be resultData.data */
    getResults?: (resultData: Record<string, unknown>) => unknown;
    /** The return value of the filterBy will be used by polling trigger's default filter methods. If left blank, the response of the action will not be filtered. */
    filterBy?: PollingTriggerFilterBy<TPollingAction>;
    /** By default this is a date. This allows the user to determine what kind of comparison we do in the filtering step. */
    filterValueType?: "date" | "number";
    /** If defined, the trigger will be created with an input that will allow users to define the starting value to begin polling by. This value is not needed if you plan to define your own perform.*/
    includeStartingInput?: boolean;
  };
  /** Not relevant to polling triggers using default behavior. */
  perform?: never;
  inputs?: never;
};
export type PollingTriggerCustomDefinition<
  TInputs extends Inputs & { __prismatic_first_starting_value?: never },
  TConfigVars extends ConfigVarResultCollection,
  TPayload extends TriggerPayload,
  TResult extends PollingTriggerResult<TPayload>,
  TPerformPayload extends PollingTriggerPerformPayload,
  TPollingAction extends PollingActionDefinition<Inputs, TConfigVars, any>,
> = PollingTriggerBaseDefinition<TInputs, TConfigVars> & {
  /** Defines how the Trigger is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** Defines your trigger's polling behavior. */
  pollAction: {
    /** The action that this trigger will be running every poll. */
    action: TPollingAction;
    /** Defining this map will allow you to pipe through values from the trigger context, payload, or params, through to the action inputs. */
    inputMap?: Partial<{
      [K in keyof TPollingAction["inputs"]]: (context: any, payload: any, params: any) => unknown;
    }>;
    /** Not relevant to polling triggers using custom behavior. */
    filterBy?: never;
    filterValueType?: never;
    includeStartingInput?: never;
  };
  /** Function to perform when this Trigger is invoked. A default perform will be provided for most polling triggers but defining this allows for custom behavior. */
  perform: PollingTriggerPerformFunction<TInputs, TConfigVars, TPerformPayload, TPayload, TResult>;
  /** Function to execute when an Instance of an Integration with a Flow that uses this Trigger is deployed. */
  onInstanceDeploy?: TriggerEventFunction<TInputs, TConfigVars>;
  /** Function to execute when an Instance of an Integration with a Flow that uses this Trigger is deleted. */
  onInstanceDelete?: TriggerEventFunction<TInputs, TConfigVars>;
  /** InputFields to present in the Prismatic interface for configuration of this Trigger. */
  inputs?: TInputs;
};

export const isPollingTriggerDefinition = (
  ref: unknown,
): ref is PollingTriggerDefinition<
  Inputs,
  any,
  any,
  any,
  any,
  PollingActionDefinition<Inputs, any, any>
> => typeof ref === "object" && ref !== null && "pollAction" in ref;

export const isPollingTriggerCustomDefinition = (
  ref: unknown,
): ref is PollingTriggerCustomDefinition<
  Inputs,
  any,
  any,
  any,
  any,
  PollingActionDefinition<Inputs, any, any>
> => typeof ref === "object" && ref !== null && "pollAction" in ref && "perform" in ref;

export const isPollingTriggerDefaultDefinition = (
  ref: unknown,
): ref is PollingTriggerDefaultDefinition<Inputs, any, PollingActionDefinition<Inputs, any, any>> =>
  typeof ref === "object" && ref !== null && "pollAction" in ref && !("perform" in ref);
