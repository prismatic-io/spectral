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
  /** Dictates possible choices or a function to generate choices for the InputField. */
  model?: InputFieldChoice[] | InputFieldModelFunction;
}

export interface CodeInputFieldDefinition extends DefaultInputFieldDefinition {
  type: "code";
  language?: string;
}

// TODO: Does this need to take in arguments? What would they be?
/** Definition of the function that returns an array of choices. */
export type InputFieldModelFunction = () => Promise<InputFieldChoice[]>;

/** Defines a single Choice option for a InputField. */
export interface InputFieldChoice {
  /** Label to display for this Choice. */
  label: string;
  /** Value to use if this Choice is chosen. */
  value: string;
}

/** InputField collection enumeration */
export type InputFieldCollection = "valuelist" | "keyvaluelist";
