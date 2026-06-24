import type { ActionPerformFunction } from "./ActionPerformFunction";
import type { ActionPerformReturn } from "./ActionPerformReturn";
import type { ComponentManifestAction } from "./ComponentManifest";
import type { ActionDisplayDefinition } from "./DisplayDefinition";
import type { ConfigVarResultCollection, Inputs } from "./Inputs";
import type { OutputSchema } from "./OutputSchema";

/**
 * Whether an action may be invoked inline to populate reference data in the Designer/EWB:
 * `SAFE` to run as-is, `UNSAFE` if running has side effects, `NOT_ALLOWED` to opt out.
 * Values are SCREAMING_SNAKE to match the backend GraphQL enum member names verbatim.
 */
export const ExperimentalPerformSupport = {
  SAFE: "SAFE",
  UNSAFE: "UNSAFE",
  NOT_ALLOWED: "NOT_ALLOWED",
} as const;

export type ExperimentalPerformSupport =
  (typeof ExperimentalPerformSupport)[keyof typeof ExperimentalPerformSupport];

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
  experimentalExamplePerform?: ActionPerformFunction<
    TInputs,
    TConfigVars,
    Record<string, Record<string, ComponentManifestAction>>,
    TAllowsBranching,
    TReturn
  >;
  experimentalExamplePerformSupport?: ExperimentalPerformSupport;
  experimentalPerformSupport?: ExperimentalPerformSupport;
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
  /**
   * Declares the shape of this action's output `data` as a JSON Schema, used by
   * the Prismatic UI to let integration authors reference this step's output
   * before a real execution has produced data. A discriminated union:
   * `{ type: "actionOutput", schema }` for a single payload shape, or
   * `{ type: "branchingOutput", branchSchemas }` for a per-branch map of shapes.
   * Descriptive only — it is not enforced at runtime.
   *
   * @remarks
   * Describes the `data` payload only, not the full return envelope
   * (`statusCode`, `contentType`, state fields). `branchingOutput` requires
   * `staticBranchNames`; it is not supported with `dynamicBranchInput`.
   */
  outputSchema?: OutputSchema;
}
