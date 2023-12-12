import {
  DataSourceDefinition,
  ConnectionDefinition,
  ActionPerformFunction,
  ActionPerformReturn,
  TriggerEventFunction,
  TriggerPerformFunction,
  Inputs,
  TriggerResult,
  DataSourceType,
} from ".";

/** Defines attributes of a Code-Native Integration. */
export type IntegrationDefinition = {
  /** The unique name for this Integration. */
  name: string;
  /** Optional description for this Integration. */
  description?: string;
  /** Optional path to icon to use for this Integration. Path should be relative to the built Integration source. */
  iconPath?: string;
  /** Optional category for this Integration. */
  category?: string;
  /** Optional documentation for this Integration. */
  documentation?: string;
  /** Optional version identifier for this Integration. */
  version?: string;
  /** Optional labels for this Integration. */
  labels?: string[];
  /** Optional endpoint type used by Instances of this Integration.
   *  A Preprocess Flow Config must be specified when using anything other than 'Flow Specific'.
   *  @default EndpointType.FlowSpecific. */
  endpointType?: EndpointType;
  /** Optional Preprocess Flow configuration for when the Trigger payload contains the flow routing attributes.
   *  Cannot specify this if a Preprocess Flow is also configured. */
  triggerPreprocessFlowConfig?: PreprocessFlowConfig;
  /** Flows for this Integration. */
  flows: Flow[];
  /** Config Vars used on this Integration. */
  configVars?: ConfigVar[];
  /** Config Wizard Pages for this Integration. */
  configPages?: ConfigPage[];
  /** Specifies any Data Sources that are defined as part of this Integration. */
  dataSources?: Record<string, CodeNativeDataSource>;
};

/** Defines common attributes of a Flow of a Code-Native Integration. */
type BaseFlow = {
  /** The unique name for this Flow. */
  name: string;
  /** Optional description for this Flow. */
  description?: string;
  /** Optional Preprocess Flow configuration for when the result of this Flow contains the flow routing attributes. Only one Flow per Integration may define this. */
  preprocessFlowConfig?: PreprocessFlowConfig;
  /** Optional value that specifies whether this Flow is synchronous. @default false */
  isSynchronous?: boolean;
  /** Optional Retry Configuration for this Flow. */
  retryConfig?: RetryConfig;
  /** Optional security configuration to use for the endpoint of this Flow. @default EndpointSecurityType.CustomerOptional */
  endpointSecurityType?: EndpointSecurityType;
  /** Optional list of API key(s) to use for the endpoint of this Flow when the endpoint security type is EndpointSecurityType.Organization. */
  organizationApiKeys?: string[];
  /** Optional schedule configuration that defines the frequency with which this Flow will be automatically executed. */
  schedule?: FlowSchedule;
  /** Optional error handling configuration. */
  errorConfig?: StepErrorConfig;
  /** Specifies the main function for this Flow */
  onExecution: ActionPerformFunction<
    Inputs,
    false,
    ActionPerformReturn<false, unknown>
  >;
};

/** Defines attributes of a Flow that will have custom Trigger logic. */
type CustomTriggerFlow = BaseFlow & {
  /** Specifies the trigger function for this Flow, which returns a payload and optional HTTP response. */
  onTrigger: TriggerPerformFunction<Inputs, false, TriggerResult<false>>;
  /** Specifies the function to execute when an Instance of this Integration is deployed. */
  onInstanceDeploy?: TriggerEventFunction<Inputs>;
  /** Specifies the function to execute when an Instance of an Integration is deleted. */
  onInstanceDelete?: TriggerEventFunction<Inputs>;
};

/** Defines attributes of a Flow that will use a Trigger from an existing Component. */
type PrebuiltTriggerFlow = BaseFlow & {
  /** Specifies the prebuilt Trigger that will run when this Flow executes. */
  trigger: TriggerReference;
};

/** Defines attributes of a Flow of a Code-Native Integration. */
export type Flow = CustomTriggerFlow | PrebuiltTriggerFlow;

/** Defines attributes of a Data Source that is defined as part of a Code Native Integration. */
export type CodeNativeDataSource = Pick<
  DataSourceDefinition<Inputs, DataSourceType>,
  "display" | "perform" | "dataSourceType" | "detailDataSource"
>;

/** Defines attributes of a reference to an existing Trigger. */
export type TriggerReference = {
  /** Attributes of the referenced Component. */
  component: ComponentReference;
  /** The unique key that identifies the Trigger within the Component. */
  key: string;
  /** Optional input values for this Trigger. */
  inputs?: InputValues;
};

/** Defines attributes of a reference to an existing Data Source. */
export type DataSourceReference = {
  /** Attributes of the referenced Component. */
  component: ComponentReference;
  /** The unique key that identifies the Data Source within the Component. */
  key: string;
};

/** Defines attributes of a reference to a member of an existing Component. */
export type ComponentReference = {
  /** The unique key that identifies the Component. */
  key: string;
  /** The version of the Component. */
  version: number | "LATEST";
  /** Specifies whether the Component is in the public library or a private Component. */
  isPublic: boolean;
};

/** Common attribute shared by all types of Config Vars. */
type BaseConfigVar = {
  /** The unique key for this Config Var. */
  key: string;
  /** Optional description for this Config Var. */
  description?: string;
  /** Optional value that specifies whether this Config Var is only configurable by Organization users. @default false  */
  orgOnly?: boolean;
  /** Optional input values for this Config Var. */
  inputs?: InputValues;
  /** Optional value that specifies whether this Config Var is visible to an Organization deployer. @default true */
  visibleToOrgDeployer?: boolean;
  /** Optional value that specifies whether this Config Var is visible to a Customer deployer. @default true */
  visibleToCustomerDeployer?: boolean;
};

/** Defines attributes of a standard Config Var. */
export type StandardConfigVar = BaseConfigVar & {
  /** Optional default value for the Config Var. */
  defaultValue?: string;
  /** The data type of the Config Var. */
  dataType: ConfigVarDataType;
  /** Optional list of picklist values if the Config Var is a multi-choice selection value. */
  pickList?: string[];
  /** Optional schedule type that defines the cadence of the schedule. */
  scheduleType?: ScheduleType;
  /** Optional value to use as a timezone if the Config Var is a schedule value. */
  timeZone?: string;
  /** Optional value to specify the type of language if the Config Var is a code value. */
  codeLanguage?: CodeLanguageType;
  /** Optional value to specify the type of collection if the Config Var is multi-value. */
  collectionType?: CollectionType;
  /** Optional value to specify the Data Source where the Config Var sources
   *  its values. If it's a string then it's expected to be the key of a
   *  CodeNativeDataSource defined in the Code Native Integration. Otherwise it
   *  is expected to be a reference to an existing Data Source. */
  dataSource?: string | DataSourceReference;
};

/** Defines attributes of a Config Var that represents a Connection. */
export type ConnectionConfigVar = Omit<
  BaseConfigVar,
  "description" | "inputs"
> &
  ConnectionDefinition;

export type ConnectionRefConfigVar = BaseConfigVar & {
  /** Attributes of the referenced Component. */
  component: ComponentReference;
};

export type ConfigVar =
  | StandardConfigVar
  | ConnectionConfigVar
  | ConnectionRefConfigVar;

/** Defines attributes of a Config Wizard Page used when deploying an Instance of an Integration. */
export type ConfigPage = {
  /** The unique name for this Config Page. */
  name: string;
  /** Specifies an optional tagline for this Config Page. */
  tagline?: string;
  /** Optional value that specifies whether this Config Page is configured as
   *  part of User Level Configuration. @default false */
  userLevelConfigured?: boolean;
  /** Elements included on this Config Page. */
  elements: ConfigPageElement[];
};

/** Defines attributes of Inputs for Connections, Actions, Triggers,
 *  Data Sources, and Config Vars. */
export type InputValues = Record<string, InputValue>;
export type InputValue = SimpleInputValue | ComplexInputValue;
export type SimpleInputValue = {
  name?: string;
  type: SimpleInputValueType;
  value: string;
  meta?: Record<string, unknown>;
};
export type ComplexInputValue = {
  name?: string;
  type: "complex";
  value: ComplexInputValueType;
  meta?: Record<string, unknown>;
};
export type ComplexInputValueType = (
  | string
  | InputValue
  | ComplexInputValueType
)[];

/** Defines attributes of an Element that appears on a Config Wizard Page. */
export type ConfigPageElement = {
  /** Specifies what type of data is represented by this Element. */
  type: ConfigPageElementType;
  /** Specifies the value of this Element. */
  value: string;
};

/** Defines attributes of a Preprocess Flow Configuration used by a Flow of an Integration. */
export type PreprocessFlowConfig = {
  /** Name of the field in the data payload returned by the Preprocess Flow to use for a Flow Name. */
  flowNameField: string;
  /** Optional name of the field in the data payload returned by the Preprocess Flow to use for an External Customer Id. */
  externalCustomerIdField?: string;
  /** Optional name of the field in the data payload returned by the Preprocess Flow to use for an External Customer User Id. */
  externalCustomerUserIdField?: string;
};

/** Defines attributes of a Retry Configuration used by a Flow of an Integration. */
export type RetryConfig = {
  /** The maximum number of retry attempts. Must be between 0 and 10. */
  maxAttempts: number;
  /** The delay in minutes to wait between retry attempts. Must be between 0 and 60. */
  delayMinutes: number;
  /** Specifies whether to use exponential backoff to calculate the delay between retry attempts. */
  usesExponentialBackoff: boolean;
  /** Name of the field in the data payload returned by the Flow Trigger to use as a Unique Request ID for retry request cancellation. */
  uniqueRequestIdField?: string;
};

/** Defines attributes of a Step Error Configuration used to determine how to handle errors during Flow step execution. */
export type StepErrorConfig = {
  /** Defines the type of error handler. */
  errorHandlerType: StepErrorHandlerType;
  /** The maximum number of retry attempts. Must be between 0 and 5. */
  maxAttempts?: number;
  /** The delay in seconds to wait between retry attempts. Must be between 0 and 60. */
  delaySeconds?: number;
  /** Specifies whether to use exponential backoff to calculate the delay between retry attempts. @default false */
  usesExponentialBackoff?: boolean;
  /** Specifies whether to ignore the final error after the final retry attempt. @default false */
  ignoreFinalError?: boolean;
};

/** Defines attributes of a Schedule that controls how often a Flow is automatically executed. */
export type FlowSchedule =
  | {
      /** The cron expression to use for defining an execution schedule. */
      cronExpression: string;
      /** Specifies an optional value to use as the timezone. */
      timeZone?: string;
    }
  | {
      /** The key of the Config Var whose value will define the execution schedule. */
      configVarKey: string;
      /** Specifies an optional value to use as the timezone. */
      timeZone?: string;
    };

/** Choices of Simple Input Value Types that may be used by Simple Input Values. */
export enum SimpleInputValueType {
  Value = "value",
  Reference = "reference",
  ConfigVar = "configVar",
  Template = "template",
}

/** Choices of Endpoint Types that may be used by Instances of an Integration. */
export enum EndpointType {
  FlowSpecific = "flow_specific",
  InstanceSpecific = "instance_specific",
  SharedInstance = "shared_instance",
}

/** Choices of Endpoint Security Types that may be used by endpoints of a Flow. */
export enum EndpointSecurityType {
  Unsecured = "unsecured",
  CustomerOptional = "customer_optional",
  CustomerRequired = "customer_required",
  Organization = "organization",
}

/** Choices of Config Page Element Types that may be used for Elements on a Config Wizard Page. */
export enum ConfigPageElementType {
  ConfigVar = "configVar",
  HTML = "htmlElement",
  JSONForm = "jsonForm",
}

/** Choices of Step Error Handlers that define the behavior when a step error occurs. */
export enum StepErrorHandlerType {
  Fail = "fail",
  Ignore = "ignore",
  Retry = "retry",
}

/** Choices for Schedules that add context for the cadence of a given schedule. */
export enum ScheduleType {
  None = "none",
  Custom = "custom",
  Minute = "minute",
  Hour = "hour",
  Day = "day",
  Week = "week",
}

/** Supported data types for Config Vars. */
export enum ConfigVarDataType {
  String = "string",
  Date = "date",
  Timestamp = "timestamp",
  Picklist = "picklist",
  Schedule = "schedule",
  Code = "code",
  Boolean = "boolean",
  Number = "number",
  ObjectSelection = "objectSelection",
  ObjectFieldMap = "objectFieldMap",
  JSONForm = "jsonForm",
}

/** Choices of programming languages that may be used for Config Var code values. */
export enum CodeLanguageType {
  JSON = "json",
  XML = "xml",
  HTML = "html",
}

/** Choices of collection types for multi-value Config Vars. */
export enum CollectionType {
  ValueList = "valuelist",
  KeyValueList = "keyvaluelist",
}
