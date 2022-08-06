import { ConditionalExpression } from "./conditional-logic";

export type ObjectSelection = {
  key: string;
  label?: string;
  selected?: boolean;
  fields: {
    key: string;
    label?: string;
  }[];
}[];

export type ObjectFieldMap = {
  key: string;
  label?: string;
  value: {
    objectKey: string;
    objectLabel?: string;
    fieldKey: string;
    fieldLabel?: string;
  };
  defaultValue?: {
    objectKey: string;
    objectLabel?: string;
    fieldKey: string;
    fieldLabel?: string;
  };
}[];

export type JSONForm = {
  schema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
  data: unknown;
};

/** InputField type enumeration. */
export type InputFieldType = InputFieldDefinition["type"];
export const InputFieldDefaultMap: Record<InputFieldType, string | undefined> =
  {
    string: "",
    data: "",
    text: "",
    password: "",
    boolean: "false",
    code: "",
    conditional: undefined,
    connection: undefined,
    objectselection: undefined,
    objectfieldmap: undefined,
    jsonform: undefined,
  };

export type Inputs = Record<string, InputFieldDefinition>;
export type ConnectionInput = (
  | StringInputField
  | DataInputField
  | TextInputField
  | PasswordInputField
  | BooleanInputField
) & { shown?: boolean };

export type InputFieldDefinition =
  | StringInputField
  | DataInputField
  | TextInputField
  | PasswordInputField
  | BooleanInputField
  | CodeInputField
  | ConditionalInputField
  | ConnectionInputField
  | ObjectSelectionInputField
  | ObjectFieldMapInputField
  | JSONFormInputField;

export type InputCleanFunction<TValue, TResult = TValue> = (
  value: TValue
) => TResult;

interface BaseInputField {
  /** Interface label of the InputField. */
  label: { key: string; value: string } | string;
  /** Text to show as the InputField placeholder. */
  placeholder?: string;
  /** Additional text to give guidance to the user configuring the InputField. */
  comments?: string;
  /** Example valid input for this InputField. */
  example?: string;
  /** Indicate if this InputField is required. */
  required?: boolean;
}

export interface StringInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "string";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: unknown;
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
}

export interface DataInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "data";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: unknown;
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
}

export interface TextInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "text";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: unknown;
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
}

export interface PasswordInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "password";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: unknown;
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
}

export interface BooleanInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "boolean";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: unknown;
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
}

/** Defines attributes of a CodeInputField. */
export interface CodeInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "code";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: unknown;
  /** Code language of this field. */
  language?: string;
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
}

/** Defines attributes of a ConditionalInputField. */
export interface ConditionalInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "conditional";
  /** Collection type of the InputField */
  collection: Extract<InputFieldCollection, "valuelist">;
  /** Default value for this field. */
  default?: ConditionalExpression;
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
}

/** Defines attributes of a ConnectionInputField. */
export interface ConnectionInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "connection";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: Connection;
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
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

/** Defines attributes of an ObjectSelectionInputField. */
export interface ObjectSelectionInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "objectselection";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: ObjectSelection;
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
}

/** Defines attributes of an ObjectFieldMapInputField. */
export interface ObjectFieldMapInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "objectfieldmap";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: ObjectFieldMap;
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
}

/** Defines attributes of a JSONFOrmInputField. */
export interface JSONFormInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "jsonform";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: JSONForm;
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
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
