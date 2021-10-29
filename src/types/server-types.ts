/**
 * Types defined in this module describe the shape of objects that are
 * sent to Prismatic's API when a component is published. Types defined
 * should not generally be imported directly, but they're the types of
 * objects that are created by `component()` and `action()` helper functions.
 */

/** Import shared types from types/ */
import { OAuth2Type } from ".";
import { ActionContext } from "./ActionPerformFunction";
import {
  ActionDisplayDefinition,
  ComponentDisplayDefinition,
} from "./DisplayDefinition";
import { InputFieldChoice, InputFieldCollection } from "./Inputs";
import { TriggerOptionChoice } from "./TriggerDefinition";
import { TriggerPayload as _TriggerPayload } from "./TriggerPayload";
import { TriggerBaseResult, TriggerBranchingResult } from "./TriggerResult";

/** Defines attributes of a Component. */
interface ComponentBase<TPublic extends boolean> {
  /** Specifies unique key for this Component. */
  key: string;
  /** Specifies if this Component is available for all Organizations or only your own @default false */
  public?: TPublic;
  /** Defines how the Component is displayed in the Prismatic interface. */
  display: ComponentDisplayDefinition<TPublic>;
  /** Specifies the supported Actions of this Component. */
  actions?: Record<string, Action>;
  /** Specifies the supported Triggers of this Component. */
  triggers?: Record<string, Trigger>;
  /** Specifies the supported Connections of this Component. */
  connections?: Record<string, ConnectionField>;
}

export type Component<TPublic extends boolean> = ComponentBase<TPublic> &
  (TPublic extends true
    ? {
        /** Specified the URL for the Component Documentation. */
        documentationUrl: string;
      }
    : {
        /** Specified the URL for the Component Documentation. */
        documentationUrl?: string;
      });

/** Base properties of Actions and Triggers. */
interface BaseAction {
  /** Key used for the Actions map and to uniquely identify this Component in your tenant. */
  key: string;
  /** Defines how the Action is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** InputFields to present in the Prismatic interface for configuration of this Action. */
  inputs: InputField[];
  /** Optional attribute that specifies whether an Action will terminate execution. */
  terminateExecution?: boolean;
  /** Specifies whether an Action will break out of a loop. */
  breakLoop?: boolean;
  /** Determines whether an Action will allow Conditional Branching. */
  allowsBranching?: boolean;
  /** Static Branch names associated with an Action. */
  staticBranchNames?: string[];
  /** The Input associated with Dynamic Branching. */
  dynamicBranchInput?: string;
}

/** Configuration of an Action. */
export interface Action extends BaseAction {
  /** Function to perform when this Action is used and invoked. */
  perform: ActionPerformFunction;
  /** An example of the payload outputted by an Action. */
  examplePayload?:
    | ServerPerformDataStructureReturn
    | ServerPerformBranchingDataStructureReturn;
}

/** Configuration of a Trigger. */
export interface Trigger extends BaseAction {
  /** Function to perform when this Trigger is used and invoked. */
  perform: TriggerPerformFunction;
  /** Specifies whether this Trigger supports executing the Integration on a recurring schedule. */
  scheduleSupport: TriggerOptionChoice;
  /** Specifies whether this Trigger supports synchronous responses to an Integration webhook request. */
  synchronousResponseSupport: TriggerOptionChoice;
  /** An example of the payload outputted by this Trigger. */
  examplePayload?: TriggerBaseResult | TriggerBranchingResult;
  /** Specifies if this Trigger appears in the list of 'common' Triggers. Only configurable by Prismatic. @default false */
  isCommonTrigger?: boolean;
}

/** Collection of input parameters provided by the user or previous steps' outputs */
interface ActionInputParameters {
  [key: string]: unknown;
}

/** Used to represent returning conventional data and does not require content type to be specified */
export interface ServerPerformDataStructureReturn {
  /** Data structure to return from the action */
  data:
    | boolean
    | number
    | string
    | Record<string, unknown>
    | unknown[]
    | unknown;
  /** The Content Type of the payload data that can be optionally specified */
  contentType?: string;
  /** The HTTP Status code that will be used if this terminates a synchronous invocation  */
  statusCode?: number;
  /** An optional object, the keys and values of which will be persisted in the instanceState and available for subsequent actions and executions */
  instanceState?: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the executionState and available for the duration of the execution */
  executionState?: Record<string, unknown>;
}

/** Used to represent a binary or serialized data return as content type must be specified */
interface ServerPerformDataReturn {
  /** Data payload containing data of the specified contentType */
  data: Buffer | string | unknown;
  /** The Content Type of the payload data */
  contentType: string;
  /** The HTTP Status code that will be used if this terminates a synchronous invocation  */
  statusCode?: number;
  /** An optional object, the keys and values of which will be persisted in the instanceState and available for subsequent actions and executions */
  instanceState?: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the executionState and available for the duration of the execution */
  executionState?: Record<string, unknown>;
}

/** Used to represent a branching return of conventional data and does not require content type to be specified */
export interface ServerPerformBranchingDataStructureReturn
  extends ServerPerformDataStructureReturn {
  /** Name of the Branch to take. */
  branch: string;
}

/** Used to represent a binary or serialized data branching return as content type must be specified */
interface ServerPerformBranchingDataReturn extends ServerPerformDataReturn {
  /** Name of the Branch to take. */
  branch: string;
}

/** Required return type of all action perform functions */
export type ActionPerformReturn =
  | ServerPerformDataStructureReturn
  | ServerPerformBranchingDataStructureReturn
  | ServerPerformDataReturn
  | ServerPerformBranchingDataReturn
  | undefined; // Allow an action to return nothing to reduce component implementation boilerplate

/** Definition of the function to perform when an Action is invoked. */
export type ActionPerformFunction = (
  context: ActionContext,
  params: ActionInputParameters
) => Promise<ActionPerformReturn>;

export type TriggerResult =
  | TriggerBranchingResult
  | TriggerBaseResult
  | undefined; // Allow a trigger to return nothing to reduce component implementation boilerplate

/** Definition of the function to perform when a Trigger is invoked. */
export type TriggerPerformFunction = (
  context: ActionContext,
  payload: TriggerPayload,
  params: ActionInputParameters
) => Promise<TriggerResult>;

export type TriggerPayload = _TriggerPayload;

export type InputField = DefaultInputField | CodeInputField | ConnectionField;

/** Defines attributes of a InputField. */
interface DefaultInputField {
  /** Unique identifier of the InputField. Must be unique within an Action. */
  key: string;
  /** Interface label of the InputField. */
  label: string;
  /** Data type the InputField will collect. */
  type: InputFieldType;
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Text to show as the InputField placeholder. */
  placeholder?: string;
  /** Default value for this field. */
  default?: string;
  /** Additional text to give guidance to the user configuring the InputField. */
  comments?: string;
  /** Example valid input for this InputField. */
  example?: string;
  /** Indicate if this InputField is required. */
  required?: boolean;
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
}

interface CodeInputField extends DefaultInputField {
  type: "code";
  language?: string;
}

export interface ConnectionField extends DefaultInputField {
  type: "connection";
  key: string;
  oauth2Type?: OAuth2Type;
  iconPath?: string;
  inputs: (Exclude<InputField, ConnectionField> & { shown?: boolean })[];
}

/** InputField type enumeration. */
export type InputFieldType =
  | "string"
  | "text"
  | "password"
  | "boolean"
  | "code"
  | "data"
  | "conditional"
  | "connection";

/** Binary data payload */
export interface DataPayload {
  /** Raw binary data as a Buffer */
  data: Buffer;
  /** Content type of data contained within this payload */
  contentType: string;
  /** Suggested extension to use when writing the data */
  suggestedExtension?: string;
}
