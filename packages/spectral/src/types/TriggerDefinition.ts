import type {
  ActionDisplayDefinition,
  TriggerPerformFunction,
  TriggerEventFunction,
  Inputs,
  ConfigVarResultCollection,
  TriggerResult,
  TriggerPayload,
} from ".";

const optionChoices = ["invalid", "valid", "required"] as const;

export type TriggerOptionChoice = (typeof optionChoices)[number];

export const TriggerOptionChoices: TriggerOptionChoice[] = [...optionChoices];

/**
 * TriggerDefinition is the type of the object that is passed in to `trigger` function to
 * define a component trigger. See
 * https://prismatic.io/docs/custom-connectors/triggers/
 */
export interface TriggerDefinition<
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
