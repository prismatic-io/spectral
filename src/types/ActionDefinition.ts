import {
  PerformReturn,
  ActionDisplayDefinition,
  ActionPerformFunction,
  Inputs,
} from ".";

/**
 * ActionDefinition is the type of the object that is passed in to `action` function to
 * define a component action.
 */
export interface ActionDefinition<
  T extends Inputs,
  AllowsBranching extends boolean,
  ReturnData extends PerformReturn<AllowsBranching, unknown>
> {
  /** Defines how the Action is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** Function to perform when this Action is invoked. */
  perform: ActionPerformFunction<T, AllowsBranching, ReturnData>;
  /** InputFields to present in the Prismatic interface for configuration of this Action. */
  inputs: T;
  /** Optional attribute that specifies whether an Action will terminate execution.*/
  terminateExecution?: boolean;
  /** Determines whether an Action will allow Conditional Branching.*/
  allowsBranching?: AllowsBranching;
  /** Static Branch names associated with an Action. */
  staticBranchNames?: string[];
  /** The Input associated with Dynamic Branching.*/
  dynamicBranchInput?: string;
  /** An example of the payload outputted by an Action*/
  examplePayload?: ReturnData;
}
