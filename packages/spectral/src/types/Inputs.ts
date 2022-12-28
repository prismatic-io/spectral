import { ConditionalExpression } from "./conditional-logic";
import { JsonSchema, UISchemaElement } from "@jsonforms/core";

export type Element = {
  key: string;
  label?: string;
};

export type ObjectSelection = {
  object: Element;
  fields?: Element[];
  defaultSelected?: boolean;
}[];

export type ObjectFieldMap = {
  fields: {
    field: Element;
    mappedObject?: Element;
    mappedField?: Element;
    defaultObject?: Element;
    defaultField?: Element;
  }[];
  options?: {
    object: Element;
    fields: Element[];
  }[];
};

export type JSONForm = {
  /**
   * The data/JSON schema defines the underlying data to
   * be shown in the UI (objects, properties, and their
   * types). See https://jsonforms.io/docs
   */
  schema: JsonSchema;
  /**
   * The UI schema defines how this data is rendered as a
   * form, e.g. the order of controls, their visibility,
   * and the layout. See https://jsonforms.io/docs/uischema/
   */
  uiSchema: UISchemaElement;
  /**
   * Optional default data to use in the inputs of your form
   */
  data?: Record<string, unknown>;
};

export type DynamicObjectSelection = string;

export type DynamicFieldSelection = string;

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
    objectSelection: undefined,
    objectFieldMap: undefined,
    jsonForm: undefined,
    dynamicObjectSelection: "",
    dynamicFieldSelection: "",
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
  | JSONFormInputField
  | DynamicObjectSelectionInputField
  | DynamicFieldSelectionInputField;

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
  type: "objectSelection";
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
  type: "objectFieldMap";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: ObjectFieldMap;
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
}

/** Defines attributes of a JSONFormInputField. */
export interface JSONFormInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "jsonForm";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: JSONForm;
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
}

/** Defines attributes of a DynamicObjectSelectionInputField */
export interface DynamicObjectSelectionInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "dynamicObjectSelection";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: unknown;
  /** Clean function */
  clean?: InputCleanFunction<NonNullable<this["default"]>>;
}

/** Defines attributes of a SelectedFieldInputField */
export interface DynamicFieldSelectionInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "dynamicFieldSelection";
  /** Collection type of the InputField */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: unknown;
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
