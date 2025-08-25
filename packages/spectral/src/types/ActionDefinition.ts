import type {
  ActionDisplayDefinition,
  ActionPerformFunction,
  ActionPerformReturn,
  ConfigVarResultCollection,
  Inputs,
  ComponentManifestAction,
} from ".";

/**
 * ActionDefinition is the type of the object that is passed in to `action` function to
 * define a component action. See
 * https://prismatic.io/docs/custom-connectors/actions/
 */
export interface ActionDefinition<
  TInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TAllowsBranching extends boolean = boolean,
  TReturn extends ActionPerformReturn<TAllowsBranching, unknown> = ActionPerformReturn<
    TAllowsBranching,
    unknown
  >,
> {
  /** Defines how the action is displayed in the Prismatic UI. */
  display: ActionDisplayDefinition;
  /** The function to perform when this action is invoked. */
  perform: ActionPerformFunction<
    TInputs,
    TConfigVars,
    Record<string, Record<string, ComponentManifestAction>>,
    TAllowsBranching,
    TReturn
  >;
  /**
   * The inputs to present a low-code integration builder. Values of these inputs
   * are passed to the `perform` function when the action is invoked.
   */
  inputs: TInputs;
  /** Attribute that specifies whether an action will terminate execution.*/
  terminateExecution?: boolean;
  /** Specifies whether an action will break out of a loop. */
  breakLoop?: boolean;
  /**
   * Determines whether an action will allow branching. See
   * https://prismatic.io/docs/custom-connectors/branching/
   */
  allowsBranching?: TAllowsBranching;
  /**
   * Static branches associated with an action.
   * Use if your action supports branching. See
   * https://prismatic.io/docs/custom-connectors/branching/
   */
  staticBranchNames?: string[];
  /** The input field associated with dynamic branching. */
  dynamicBranchInput?: string;
  /** An example of the payload output by this action. */
  examplePayload?: Awaited<ReturnType<this["perform"]>>;
}
