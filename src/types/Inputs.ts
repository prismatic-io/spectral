import { InputFieldType } from ".";

export type Inputs = Record<string, InputFieldDefinition>;

export type InputFieldDefinition =
  | DefaultInputFieldDefinition
  | CodeInputFieldDefinition;

/** Defines attributes of a InputField. */
export interface DefaultInputFieldDefinition {
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

export interface CodeInputFieldDefinition extends DefaultInputFieldDefinition {
  type: "code";
  language?: string;
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
