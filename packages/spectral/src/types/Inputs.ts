import { ConditionalExpression } from "./conditional-logic";
import { JsonSchema, UISchemaElement } from "@jsonforms/core";

/**
 * KeyValuePair input parameter type.
 * This allows users to input multiple keys / values as an input.
 * To see an example of how this can be used, see the `tagging` input
 * of the `putObject` action of the AWS S3 component:
 * https://github.com/prismatic-io/examples/blob/main/components/aws-s3/src/actions.ts
 */
export interface KeyValuePair<V = unknown> {
  /** Key of the KeyValuePair */
  key: string;
  /** Value of the KeyValuePair */
  value: V;
}

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

export type Schedule = {
  value: string;
  schedule_type: string;
  time_zone: string;
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
  data?: Record<string, unknown> | unknown[];
};

export type DynamicObjectSelection = string;

export type DynamicFieldSelection = string;

/** InputField type enumeration. */
export type InputFieldType = InputFieldDefinition["type"];
export const InputFieldDefaultMap: Record<InputFieldType, string | undefined> = {
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
  date: "",
  timestamp: "",
  flow: "",
};

export type Inputs = Record<string, InputFieldDefinition>;

export type ConnectionInput = (
  | StringInputField
  | DataInputField
  | TextInputField
  | PasswordInputField
  | BooleanInputField
) & {
  shown?: boolean;
  writeOnly?: true;
};

export type OnPremConnectionInput = {
  onPremControlled: true;
} & ConnectionInput;

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
  | DynamicFieldSelectionInputField
  | DateInputField
  | DateTimeInputField
  | FlowInputField;

export type InputCleanFunction<TValue, TResult = TValue> = (value: TValue) => TResult;

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
  /** Key of the data source that can be used to set the value of this input. */
  dataSource?: string;
}

type CollectionOptions<T> = SingleValue<T> | ValueListCollection<T> | KeyValueListCollection<T>;

interface SingleValue<T> {
  /** Collection type of the InputField */
  collection?: undefined;
  /** Default value for this field. */
  default?: T;
}

interface ValueListCollection<T> {
  /** Collection type of the InputField */
  collection: "valuelist";
  /** Default value for this field. */
  default?: T[];
}

interface KeyValueListCollection<T> {
  /** Collection type of the InputField */
  collection: "keyvaluelist";
  /** Default value for this field. */
  default?: KeyValuePair<T>[];
}

export type StringInputField = BaseInputField & {
  /** Data type the InputField will collect. */
  type: "string";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

export type DataInputField = BaseInputField & {
  /** Data type the InputField will collect. */
  type: "data";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

export type TextInputField = BaseInputField & {
  /** Data type the InputField will collect. */
  type: "text";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

export type PasswordInputField = BaseInputField & {
  /** Data type the InputField will collect. */
  type: "password";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

export type BooleanInputField = BaseInputField & {
  /** Data type the InputField will collect. */
  type: "boolean";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

export type ConnectionTemplateInput = BaseInputField & {
  /** Data type the InputField will collect. */
  type?: "template";
  /** Default templated string. */
  defaultValue: string;
  /** Will not be user-facing. */
  shown?: false;
};

/** Defines attributes of a CodeInputField. */
export type CodeInputField = BaseInputField & {
  /** Data type the InputField will collect. */
  type: "code";
  /** Code language for syntax highlighting. For no syntax highlighting, choose "plaintext" */
  language:
    | "css"
    | "graphql"
    | "handlebars"
    | "hcl"
    | "html"
    | "javascript"
    | "json"
    | "liquid"
    | "markdown"
    | "mysql"
    | "pgsql"
    | "plaintext"
    | "sql"
    | "typescript"
    | "xml"
    | "yaml";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

/** Defines attributes of a ConditionalInputField. */
export interface ConditionalInputField extends BaseInputField {
  /** Data type the InputField will collect. */
  type: "conditional";
  /** Collection type of the InputField */
  collection: InputFieldCollection;
  /** Default value for this field. */
  default?: ConditionalExpression;
  /** Clean function */
  clean?: InputCleanFunction<this["default"] | null>;
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
  clean?: InputCleanFunction<this["default"] | null>;
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
  clean?: InputCleanFunction<this["default"]>;
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
  clean?: InputCleanFunction<this["default"]>;
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
  clean?: InputCleanFunction<this["default"]>;
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
  clean?: InputCleanFunction<this["default"]>;
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
  clean?: InputCleanFunction<this["default"]>;
}

export type DateInputField = BaseInputField & {
  /** Data type the InputField will collect. */
  type: "date";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

export type DateTimeInputField = BaseInputField & {
  /** Data type the InputField will collect. */
  type: "timestamp";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

/** Defines a single Choice option for a InputField. */
export interface InputFieldChoice {
  /** Label to display for this Choice. */
  label: string;
  /** Value to use if this Choice is chosen. */
  value: string;
}

/** InputField collection enumeration */
export type InputFieldCollection = "valuelist" | "keyvaluelist";

/** Config variable result collection */
export type ConfigVarResultCollection = Record<
  string,
  string | Schedule | Connection | unknown | ObjectSelection | ObjectFieldMap
>;

export type FlowInputField = BaseInputField & {
  /** Data type the InputField will collect. */
  type: "flow";
  /** Clean function */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;
