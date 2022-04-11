import { InputFieldDefaultMap, InputFieldType } from ".";

export type Inputs = Record<string, InputFieldDefinition>;
export type ConnectionInput = DefaultInputFieldDefinition & { shown?: boolean };

export type InputFieldDefinition =
  | DefaultInputFieldDefinition
  | CodeInputFieldDefinition
  | ConditionalInputField
  | ConnectionInputField;

interface BaseInputFieldDefinition {
  /** Data type the InputField will collect. */
  type: InputFieldType;
  /** Interface label of the InputField. */
  label: { key: string; value: string } | string;
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Text to show as the InputField placeholder. */
  placeholder?: string;
  /** Default value for this field. */
  default?: typeof InputFieldDefaultMap[this["type"]];
  /** Additional text to give guidance to the user configuring the InputField. */
  comments?: string;
  /** Example valid input for this InputField. */
  example?: string;
  /** Indicate if this InputField is required. */
  required?: boolean;
}

/** Defines attributes of a InputField. */
export interface DefaultInputFieldDefinition extends BaseInputFieldDefinition {
  type: Exclude<InputFieldType, "code" | "conditional" | "connection">;
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
}

/** Defines attributes of a CodeInputField. */
export interface CodeInputFieldDefinition extends BaseInputFieldDefinition {
  type: Extract<InputFieldType, "code">;
  /** Code language of this field. */
  language?: string;
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
}

/** Defines attributes of a ConditionalInputField. */
export interface ConditionalInputField extends BaseInputFieldDefinition {
  type: Extract<InputFieldType, "conditional">;
}

/** Defines attributes of a ConnectionInputField. */
export interface ConnectionInputField extends BaseInputFieldDefinition {
  type: Extract<InputFieldType, "connection">;
}

export interface Connection {
  /** Key of the Connection type. */
  key: string;
  /** Key for the Config Variable hosting this Connection. */
  configVarKey: string;
  /** Field values supplied to this Connection. */
  fields: { [key: string]: unknown };
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
