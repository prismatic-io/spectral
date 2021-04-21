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
  /** Specified the URL for the Component Documentation. */
  documentationUrl?: string;
}

export type ConfigurationVariablesCollection = Record<string, string>;

/** Authorization settings for a component */
interface AuthorizationDefinition {
  /** Whether authorization is required */
  required: boolean;
  /** Supported authorization methods */
  methods: AuthorizationMethod[];
}

const authorizationMethods = [
  "basic",
  "api_key",
  "api_key_secret",
  "private_key",
  "oauth2",
  "oauth2_client_credentials",
] as const;

export type AuthorizationMethod = typeof authorizationMethods[number];

export const AvailableAuthorizationMethods: AuthorizationMethod[] = [
  ...authorizationMethods,
];

const oauth2AuthorizationMethods = [
  "oauth2",
  "oauth2_client_credentials",
] as const;

export type OAuth2AuthorizationMethod = typeof oauth2AuthorizationMethods[number];

export const AvailableOAuth2AuthorizationMethods: OAuth2AuthorizationMethod[] = [
  ...oauth2AuthorizationMethods,
];

export interface BasicCredential {
  authorizationMethod: "basic";
  fields: {
    username: string;
    password: string;
  };
}

export interface ApiKeyCredential {
  authorizationMethod: "api_key";
  fields: {
    api_key: string;
  };
}

export interface ApiKeySecretCredential {
  authorizationMethod: "api_key_secret";
  fields: {
    api_key: string;
    api_secret: string;
  };
}

export interface PrivateKeyCredential {
  authorizationMethod: "private_key";
  fields: {
    username: string;
    private_key: string;
  };
}
export interface OAuth2Credential {
  authorizationMethod: OAuth2AuthorizationMethod;
  redirectUri: string;
  fields: {
    client_id: string;
    client_secret: string;
    token_uri: string;
    auth_uri?: string;
    scopes?: string;
  };
  token: {
    access_token: string;
    token_type: string;
    refresh_token?: string;
    expires_in?: string;
    [key: string]: string | undefined;
  };
  context: { [key: string]: string };
}

export type Credential =
  | BasicCredential
  | ApiKeyCredential
  | ApiKeySecretCredential
  | PrivateKeyCredential
  | OAuth2Credential;

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
  body: unknown;
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
  /** Optional attribute that specifies whether an Action will terminate execution.*/
  terminateExecution?: boolean;
  /** Determines whether an Action will allow Conditional Branching.*/
  allowsBranching?: boolean;
  /**Static Branch names associated with an Action. */
  staticBranchNames?: string[];
  /**The Input associated with Dynamic Branching.*/
  dynamicBranchInput?: string;
  /**An example of the payload outputted by an Action*/
  examplePayload?:
    | PerformDataStructureReturn
    | PerformBranchingDataStructureReturn;
}

/** Action-specific Display attributes. */
export interface ActionDisplayDefinition extends DisplayDefinition {
  /** Directions to help guide the user if additional configuration is required for this Action. */
  directions?: string;
  /** Indicate that this Action is important and/or commonly used from the parent Component. Should be enabled sparingly. */
  important?: boolean;
}

export type ActionLoggerFunction = (...args: unknown[]) => void;

export interface ActionLogger {
  debug: ActionLoggerFunction;
  info: ActionLoggerFunction;
  warn: ActionLoggerFunction;
  error: ActionLoggerFunction;
}

/** Context provided to perform method containing helpers and contextual data */
export interface ActionContext {
  /** Credential for the action, optional since not all actions will require a credential */
  credential?: Credential;
  /** Logger for permanent logging; console calls are also captured */
  logger: ActionLogger;
  /** A key/value store that may be used to store small amounts of data that is persisted between Instance executions */
  instanceState: Record<string, unknown>;
  /** A unique id that corresponds to the step on the Integration */
  stepId: string;
}

/** Collection of input parameters provided by the user or previous steps' outputs */
export interface ActionInputParameters {
  [key: string]: any;
}

/** Used to represent returning conventional data and does not require content type to be specified */
export interface PerformDataStructureReturn {
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
  state?: Record<string, unknown>;
}

/** Used to represent a binary or serialized data return as content type must be specified */
export interface PerformDataReturn {
  /** Data payload containing data of the specified contentType */
  data: Buffer | string | unknown;
  /** The Content Type of the payload data */
  contentType: string;
  /** The HTTP Status code that will be used if this terminates a synchronous invocation  */
  statusCode?: number;
  /** An optional object, the keys and values of which will be persisted in the instanceState and available for subsequent actions and executions */
  state?: Record<string, unknown>;
}

/** Used to represent a branching return of conventional data and does not require content type to be specified */
export interface PerformBranchingDataStructureReturn
  extends PerformDataStructureReturn {
  /** Name of the Branch to take. */
  branch: string;
}

/** Used to represent a binary or serialized data branching return as content type must be specified */
export interface PerformBranchingDataReturn extends PerformDataReturn {
  /** Name of the Branch to take. */
  branch: string;
}

/** Required return type of all action perform functions */
export type PerformReturn =
  | PerformDataStructureReturn
  | PerformBranchingDataStructureReturn
  | PerformDataReturn
  | PerformBranchingDataReturn
  | void; // Allow an action to return nothing to reduce component implementation boilerplate

/** Definition of the function to perform when an Action is invoked. */
export type ActionPerformFunction = (
  context: ActionContext,
  params: ActionInputParameters
) => Promise<PerformReturn>;

export type InputFieldDefinition =
  | DefaultInputFieldDefinition
  | CodeInputFieldDefinition;

/** Defines attributes of a InputField. */
export interface DefaultInputFieldDefinition {
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
  /** Dictates possible choices or a function to generate choices for the InputField. */
  model?: InputFieldChoice[] | InputFieldModelFunction;
}

export interface CodeInputFieldDefinition extends DefaultInputFieldDefinition {
  type: "code";
  language?: string;
}

/** InputField type enumeration. */
export type InputFieldType =
  | "string"
  | "text"
  | "password"
  | "boolean"
  | "code"
  | "data"
  | "conditional";

/** InputField collection enumeration */
export type InputFieldCollection = "valuelist" | "keyvaluelist";

/** KeyValuePair input parameter type */
export interface KeyValuePair<V = unknown> {
  /** Key of the KeyValuePair */
  key: string;
  /** Value of the KeyValuePair */
  value: V;
}

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
