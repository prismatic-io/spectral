import { InputFieldType } from ".";

export type Inputs = Record<string, InputFieldDefinition>;
export type ConnectionInputs = Record<
  string,
  DefaultInputFieldDefinition & { shown?: boolean }
>;

export type InputFieldDefinition =
  | DefaultInputFieldDefinition
  | CodeInputFieldDefinition
  | ConnectionFieldDefinition;

interface BaseInputFieldDefinition {
  /** Interface label of the InputField. */
  label: string;
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

/** Defines attributes of a InputField. */
export interface DefaultInputFieldDefinition extends BaseInputFieldDefinition {
  type: Exclude<InputFieldType, "code" | "connection">;
}

/** Defines attributes of a CodeInputField. */
export interface CodeInputFieldDefinition extends BaseInputFieldDefinition {
  type: Extract<InputFieldType, "code">;
  language?: string;
}

export enum OAuth2Type {
  ClientCredentials = "client_credentials",
  AuthorizationCode = "authorization_code",
}

/** Defines attributes of a ConnectionField. */
export interface ConnectionFieldDefinition extends BaseInputFieldDefinition {
  type: Extract<InputFieldType, "connection">;
  connectionKey: string;
  oauth2Type?: OAuth2Type;
  iconPath?: string;
  inputs: ConnectionInputs;
}

export interface Connection<
  TField extends ConnectionFieldDefinition = ConnectionFieldDefinition
> {
  /** Key of the Connection type. */
  key: TField["connectionKey"];
  /** Identifier for the Config Variable hosting this Connection. */
  instanceConfigVarId: string;
  /** Field values supplied to this Connection. */
  fields: { [Property in keyof TField["inputs"]]: unknown };

  token?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/** Defines a single Choice option for a InputField. */
export interface InputFieldChoice {
  /** Label to display for this Choice. */
  label: string;
  /** Value to use if this Choice is chosen. */
  value: string;
}

/** InputField collection enumeration */
export type InputFieldCollection = "valuelist" | "keyvaluelist";
