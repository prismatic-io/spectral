import {
  ActionDisplayDefinition,
  TriggerPerformFunction,
  TriggerEventFunction,
  Inputs,
  TriggerResult,
  ConfigVarResultCollection,
  TriggerPayload,
} from ".";

const optionChoices = ["invalid", "valid", "required"] as const;

export type TriggerOptionChoice = (typeof optionChoices)[number];

export const TriggerOptionChoices: TriggerOptionChoice[] = [...optionChoices];

/**
 * TriggerDefinition is the type of the object that is passed in to `trigger` function to
 * define a component trigger.
 */
export interface TriggerDefinition<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TAllowsBranching extends boolean,
  TResult extends TriggerResult<TAllowsBranching, TriggerPayload>,
> {
  /** Defines how the Trigger is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** Function to perform when this Trigger is invoked. */
  perform: TriggerPerformFunction<TInputs, TConfigVars, TAllowsBranching, TResult>;
  /** Function to execute when an Instance of an Integration with a Flow that uses this Trigger is deployed. */
  onInstanceDeploy?: TriggerEventFunction<TInputs, TConfigVars>;
  /** Function to execute when an Instance of an Integration with a Flow that uses this Trigger is deleted. */
  onInstanceDelete?: TriggerEventFunction<TInputs, TConfigVars>;
  /** InputFields to present in the Prismatic interface for configuration of this Trigger. */
  inputs: TInputs;
  /** Specifies whether this Trigger supports executing the Integration on a recurring schedule. */
  scheduleSupport: TriggerOptionChoice;
  /** Specifies whether this Trigger supports synchronous responses to an Integration webhook request. */
  synchronousResponseSupport: TriggerOptionChoice;
  /** Optional attribute that specifies whether this Trigger will terminate execution. */
  terminateExecution?: boolean;
  /** Specifies whether an Action will break out of a loop. */
  breakLoop?: boolean;
  /** Determines whether this Trigger allows Conditional Branching. */
  allowsBranching?: TAllowsBranching;
  /** Static Branch names associated with this Trigger. */
  staticBranchNames?: string[];
  /** The Input associated with Dynamic Branching. */
  dynamicBranchInput?: string;
  /** An example of the payload outputted by this Trigger. */
  examplePayload?: Awaited<ReturnType<this["perform"]>>;
  /** Specifies if this Trigger appears in the list of 'common' Triggers. Only configurable by Prismatic. @default false */
  isCommonTrigger?: boolean;
}
