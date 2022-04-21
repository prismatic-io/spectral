import {
  ActionDisplayDefinition,
  ActionPerformFunction,
  ActionPerformReturn,
  Inputs,
} from ".";

/**
 * ActionDefinition is the type of the object that is passed in to `action` function to
 * define a component action.
 */
export interface ActionDefinition<
  TInputs extends Inputs,
  TAllowsBranching extends boolean,
  TReturn extends ActionPerformReturn<TAllowsBranching, unknown>
> {
  /** Defines how the Action is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** Function to perform when this Action is invoked. */
  perform: ActionPerformFunction<TInputs, TAllowsBranching, TReturn>;
  /** InputFields to present in the Prismatic interface for configuration of this Action. */
  inputs: TInputs;
  /** Optional attribute that specifies whether an Action will terminate execution.*/
  terminateExecution?: boolean;
  /** Specifies whether an Action will break out of a loop. */
  breakLoop?: boolean;
  /** Determines whether an Action will allow Conditional Branching.*/
  allowsBranching?: TAllowsBranching;
  /** Static Branch names associated with an Action. */
  staticBranchNames?: string[];
  /** The Input associated with Dynamic Branching.*/
  dynamicBranchInput?: string;
  /** An example of the payload outputted by an Action*/
  examplePayload?: Awaited<ReturnType<this["perform"]>>;
}
