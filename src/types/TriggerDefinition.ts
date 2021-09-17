import {
  TriggerResult,
  ActionDisplayDefinition,
  TriggerPerformFunction,
  AuthorizationDefinition,
  Inputs,
} from ".";

const optionChoices = ["invalid", "valid", "required"] as const;

export type TriggerOptionChoice = typeof optionChoices[number];

export const TriggerOptionChoices: TriggerOptionChoice[] = [...optionChoices];

/**
 * TriggerDefinition is the type of the object that is passed in to `trigger` function to
 * define a component trigger.
 */
export interface TriggerDefinition<
  T extends Inputs,
  AllowsBranching extends boolean,
  Result extends TriggerResult<AllowsBranching>
> {
  /** Defines how the Trigger is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** Function to perform when this Trigger is invoked. */
  perform: TriggerPerformFunction<T, AllowsBranching, Result>;
  /** InputFields to present in the Prismatic interface for configuration of this Trigger. */
  inputs: T;
  /** Specifies whether this Trigger supports executing the Integration on a recurring schedule. */
  scheduleSupport: TriggerOptionChoice;
  /** Specifies whether this Trigger supports synchronous responses to an Integration webhook request. */
  synchronousResponseSupport: TriggerOptionChoice;
  /** Specifies Authorization settings, if applicable */
  authorization?: AuthorizationDefinition;
  /** Optional attribute that specifies whether this Trigger will terminate execution. */
  terminateExecution?: boolean;
  /** Determines whether this Trigger allows Conditional Branching. */
  allowsBranching?: AllowsBranching;
  /** Static Branch names associated with this Trigger. */
  staticBranchNames?: string[];
  /** The Input associated with Dynamic Branching. */
  dynamicBranchInput?: string;
  /** An example of the payload outputted by this Trigger. */
  examplePayload?: Result;
  /** Specifies if this Trigger appears in the list of 'common' Triggers. Only configurable by Prismatic. @default false */
  isCommonTrigger?: boolean;
}
