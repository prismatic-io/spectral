import type { ConditionalExpression } from ".";
import type { JsonSchema } from "./jsonforms/JsonSchema";
import type { UISchemaElement } from "./jsonforms/UISchemaElement";

/**
 * KeyValuePair input parameter type.
 * This allows users to input multiple keys / values as an input.
 * To see an example of how this can be used, see the `tagging` input
 * of the `putObject` action of the AWS S3 component:
 * https://github.com/prismatic-io/examples/blob/main/components/aws-s3/src/actions.ts
 */
export interface KeyValuePair<V = unknown> {
  /** Key of the KeyValuePair. */
  key: string;
  /** Value of the KeyValuePair. */
  value: V;
}

export type Element = {
  /** The value to return for this field. */
  key: string;
  /** The string to show in the UI for this field. Defaults to the value of `key` */
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
  template: "",
};

export type Inputs = Record<string, InputFieldDefinition>;

export type ConnectionInput = Omit<
  | StringInputField
  | DataInputField
  | TextInputField
  | PasswordInputField
  | BooleanInputField
  | ConnectionTemplateInputField,
  "clean"
> & {
  /** Determines if this input field should be shown in the UI. */
  shown?: boolean;
  /**
   * Determines if this input should be write-only. See
   * https://prismatic.io/docs/integrations/config-wizard/config-variables/#write-only-connection-inputs
   */
  writeOnly?: true;
};

export type OnPremConnectionInput = {
  /**
   * When this connection is attached to an on-prem agent, this
   * field will be overridden by a local on-prem value
   */
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
  | ConnectionTemplateInputField
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
  /** Name of this field to present in the UI. */
  label: { key: string; value: string } | string;
  /** Text to show in the UI as the input's placeholder. */
  placeholder?: string;
  /** Additional text to give guidance to the user configuring the input. */
  comments?: string;
  /** Example valid input for this input. */
  example?: string;
  /** Indicate if this input field is required. */
  required?: boolean;
  /** Key of the data source that can be used to set the value of this input. */
  dataSource?: string;
}

type CollectionOptions<T> = SingleValue<T> | ValueListCollection<T> | KeyValueListCollection<T>;

interface SingleValue<T> {
  /** Collection type of the input. */
  collection?: undefined;
  /** Default value for this field. */
  default?: T;
}

interface ValueListCollection<T> {
  /** Collection type of the input. */
  collection: "valuelist";
  /** Default value for this field. */
  default?: T[];
}

interface KeyValueListCollection<T> {
  /** Collection type of the input. */
  collection: "keyvaluelist";
  /** Default value for this field. */
  default?: KeyValuePair<T>[];
}

export type StringInputField = BaseInputField & {
  /** Data type the input will collect. */
  type: "string";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function. */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

export type DataInputField = BaseInputField & {
  /** Data type the input will collect. */
  type: "data";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function. */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

export type TextInputField = BaseInputField & {
  /** Data type the input will collect. */
  type: "text";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function. */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

export type PasswordInputField = BaseInputField & {
  /** Data type the input will collect. */
  type: "password";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function. */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

export type BooleanInputField = BaseInputField & {
  /** Data type the input will collect. */
  type: "boolean";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function. */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

export type ConnectionTemplateInputField = BaseInputField & {
  /** Data type the InputField will collect. */
  type: "template";
  /** Default templated string. */
  templateValue: string;
  /** Will not be user-facing. */
  shown?: false;
  /** Clean function */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

/** Defines attributes of a CodeInputField. */
export type CodeInputField = BaseInputField & {
  /** Data type the input will collect. */
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
  /** Clean function. */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

/** Defines attributes of a ConditionalInputField. */
export interface ConditionalInputField extends BaseInputField {
  /** Data type the input will collect. */
  type: "conditional";
  /** Collection type of the InputField. */
  collection: InputFieldCollection;
  /** Default value for this field. */
  default?: ConditionalExpression;
  /** Clean function. */
  clean?: InputCleanFunction<this["default"] | null>;
}

/** Defines attributes of a ConnectionInputField. */
export interface ConnectionInputField extends BaseInputField {
  /** Data type the input will collect. */
  type: "connection";
  /** Collection type of the InputField. */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: Connection;
  /** Clean function. */
  clean?: InputCleanFunction<this["default"] | null>;
}

export interface Connection {
  /** Programmatic unique key of the connection type. */
  key: string;
  /** Name of the config variable hosting this connection. */
  configVarKey: string;
  /** Values of input fields supplied to this connection. */
  fields: { [key: string]: unknown };
  /** If this connection implements OAuth 2.0, this will be an object with properties like `access_token` and `refresh_token` */
  token?: Record<string, unknown>;
  /** If this connection implements OAuth 2.0, this will contain metadata about the OAuth 2.0 tokens (like expiration time, etc). */
  context?: Record<string, unknown>;
}

/** Defines attributes of an ObjectSelectionInputField. */
export interface ObjectSelectionInputField extends BaseInputField {
  /** Data type the input will collect. */
  type: "objectSelection";
  /** Collection type of the InputField. */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: ObjectSelection;
  /** Clean function. */
  clean?: InputCleanFunction<this["default"]>;
}

/** Defines attributes of an ObjectFieldMapInputField. */
export interface ObjectFieldMapInputField extends BaseInputField {
  /** Data type the input will collect. */
  type: "objectFieldMap";
  /** Collection type of the InputField. */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: ObjectFieldMap;
  /** Clean function. */
  clean?: InputCleanFunction<this["default"]>;
}

/** Defines attributes of a JSONFormInputField. */
export interface JSONFormInputField extends BaseInputField {
  /** Data type the input will collect. */
  type: "jsonForm";
  /** Collection type of the InputField. */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: JSONForm;
  /** Clean function. */
  clean?: InputCleanFunction<this["default"]>;
}

/** Defines attributes of a DynamicObjectSelectionInputField. */
export interface DynamicObjectSelectionInputField extends BaseInputField {
  /** Data type the input will collect. */
  type: "dynamicObjectSelection";
  /** Collection type of the InputField. */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: unknown;
  /** Clean function. */
  clean?: InputCleanFunction<this["default"]>;
}

/** Defines attributes of a SelectedFieldInputField. */
export interface DynamicFieldSelectionInputField extends BaseInputField {
  /** Data type the input will collect. */
  type: "dynamicFieldSelection";
  /** Collection type of the InputField. */
  collection?: InputFieldCollection;
  /** Default value for this field. */
  default?: unknown;
  /** Clean function. */
  clean?: InputCleanFunction<this["default"]>;
}

export type DateInputField = BaseInputField & {
  /** Data type the input will collect. */
  type: "date";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function. */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

export type DateTimeInputField = BaseInputField & {
  /** Data type the input will collect. */
  type: "timestamp";
  /** Dictates possible choices for the input. */
  model?: InputFieldChoice[];
  /** Clean function. */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;

/** Defines a single Choice option for a InputField. */
export interface InputFieldChoice {
  /** Label to display for this Choice. */
  label: string;
  /** Value to use if this Choice is chosen. */
  value: string;
}

/** InputField collection enumeration. */
export type InputFieldCollection = "valuelist" | "keyvaluelist";

/** Config variable result collection. */
export type ConfigVarResultCollection = Record<
  string,
  string | Schedule | Connection | unknown | ObjectSelection | ObjectFieldMap
>;

export type FlowInputField = BaseInputField & {
  /** Data type the input will collect. */
  type: "flow";
  /** Clean function. */
  clean?: InputCleanFunction<unknown>;
} & CollectionOptions<string>;
