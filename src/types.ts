import pino from "pino";

/** Defines attributes of a Component. */
export interface ComponentDefinition {
  /** Specifies unique key for this Component. */
  key: string;
  /** Specifies if this Component is available for all Organizations or only your own @default false */
  public?: boolean;
  /** Defines how the Component is displayed in the Prismatic interface. */
  display: ComponentDisplayDefinition;
  /** Version of the Component. */
  version: string;
  /** Specifies Authorization settings, if applicable */
  authorization?: AuthorizationDefinition;
  /** Specifies the supported Actions of this Component. */
  actions: Record<string, ActionDefinition>;
}

export type ConfigurationVariablesCollection = Record<string, string>;

/** Authorization settings for a component */
interface AuthorizationDefinition {
  /** Whether authorization is required */
  required: boolean;
  /** Supported authorization methods */
  methods: AuthorizationMethod[];
}

export type AuthorizationMethod =
  | "api_key_secret"
  | "basic"
  | "private_key"
  | "api_key"
  | "oauth2";

export interface Credential {
  authorizationMethod: AuthorizationMethod;
  redirectUri?: string;
  fields: { [key: string]: string };
  token?: object;
  context?: object;
}

/** Base definition of Display properties. */
interface DisplayDefinition {
  /** Label/name to display. */
  label: string;
  /** Description to display to the user. */
  description: string;
}

/** Component extensions for display properties. */
interface ComponentDisplayDefinition extends DisplayDefinition {
  /** Path to icon to use for this Component. Path should be relative to component roto index. */
  iconPath?: string;
}

/** Request specification. */
export interface HttpRequestConfiguration {
  /** Method of the HTTP request. */
  method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE" | "HEAD";
  /** URL to send the HTTP request to. */
  url: string;
  /** Body of the request. */
  body: any;
  /** Parameters to send with the request. */
  params: Record<string, string>;
  /** Headers to send with the request. */
  headers: Record<string, string>;
}

/** Configuration of an Action. */
export interface ActionDefinition {
  /** Key used for the Actions map and to uniquely identify this Component in your tenant. */
  key: string;
  /** Defines how the Action is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** Function to perform when this Action is used and invoked. */
  perform: ActionPerformFunction;
  /** InputFields to present in the Prismatic interface for configuration of this Action. */
  inputs: InputFieldDefinition[];
}

/** Action-specific Display attributes. */
export interface ActionDisplayDefinition extends DisplayDefinition {
  /** Directions to help guide the user if additional configuration is required for this Action. */
  directions?: string;
  /** Indicate that this Action is important and/or commonly used from the parent Component. Should be enabled sparingly. */
  important?: boolean;
}

/** Context provided to perform method containing helpers and contextual data */
export interface ActionContext {
  /** Configuration variables that have been provided to the instance  */
  configVars: ConfigurationVariablesCollection;
  /** Credential for the action, optional since not all actions will require a credential */
  credential?: Credential;
  /** Pino logger if desired; console calls are also captured */
  logger: pino.Logger;
}

/** Collection of input parameters provided by the user or previous steps' outputs */
export interface ActionInputParameters {
  [key: string]: any;
}

/** Used to represent returning conventional data and does not require content type to be specified */
export interface PerformDataStructureReturn {
  /** Data structure to return from the action */
  data: number | string | object | any[];
  /** The Content Type of the payload data that can be optionally specified */
  contentType?: string;
}

/** Used to represent a binary or serialized data return as content type must be specified */
export interface PerformDataReturn {
  /** Data payload containing data of the specified contentType */
  data: Buffer | string;
  /** The Content Type of the payload data */
  contentType: string;
}

/** Required return type of all action perform functions */
export type PerformReturn =
  | PerformDataStructureReturn
  | PerformDataReturn
  | void; // Allow an action to return nothing to reduce component implementation boilerplate

/** Definition of the function to perform when an Action is invoked. */
export type ActionPerformFunction = (
  context: ActionContext,
  params: ActionInputParameters
) => Promise<PerformReturn>;

/** Defines attributes of a InputField. */
export interface InputFieldDefinition {
  /** Unique identifier of the InputField. Must be unique within an Action. */
  key: string;
  /** Interface label of the InputField. */
  label: string;
  /** Data type the InputField will collect. */
  type: InputFieldType;
  /** Text to show as the InputField placeholder. */
  placeholder?: string;
  /** Default value for this field. */
  default?: string;
  /** Additional text to give guidance to the user configuring the InputField. */
  comments?: string;
  /** Indicate if this InputField is required. */
  required?: boolean;
  /** Dictates how possible choices are provided for this InputField. */
  model?: InputFieldChoice[] | InputFieldModelFunction;
}

/** InputField type enumeration. */
export type InputFieldType =
  | "string"
  | "text"
  | "password"
  | "boolean"
  | "code"
  | "data";

/** Binary data payload */
export interface DataPayload {
  /** Raw binary data as a Buffer */
  data: Buffer;
  /** Content type of data contained within this payload */
  contentType: string;
  /** Suggested extension to use when writing the data */
  suggestedExtension?: string;
}

/** Defines a single Choice option for a InputField. */
export interface InputFieldChoice {
  /** Label to display for this Choice. */
  label: string;
  /** Value to use if this Choice is chosen. */
  value: string;
}

// TODO: Does this need to take in arguments? What would they be?
/** Definition of the function that returns an array of choices. */
export type InputFieldModelFunction = () => Promise<InputFieldChoice[]>;
