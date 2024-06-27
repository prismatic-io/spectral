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
  TriggerPayload,
  Connection,
  JSONForm,
  ObjectFieldMap,
  ObjectSelection,
  ConfigVarResultCollection,
  Schedule,
  CollectionDataSourceType,
  ComponentManifest,
} from ".";
import { Prettify, UnionToIntersection } from "./utils";

/**
 * Root ComponentRegistry type exposed for augmentation.
 *
 * The expected interface when augmenting is:
 *
 * ```ts
 * interface IntegrationDefinitionComponentRegistry {
 *   [key: string]: ComponentManifest
 * }
 * ```
 *
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IntegrationDefinitionComponentRegistry {}

/**
 * Root ConfigPages type exposed for augmentation.
 *
 * The expected interface when augmenting is:
 *
 * ```ts
 * interface IntegrationDefinitionConfigPages {
 *   [key: string]: ConfigPage
 * }
 * ```
 *
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IntegrationDefinitionConfigPages {}

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
  /** Config Wizard Pages for this Integration. */
  configPages?: ConfigPages;

  componentRegistry?: ComponentRegistry;
};

/** Defines attributes of a Flow of a Code-Native Integration. */
export interface Flow<TTriggerPayload extends TriggerPayload = TriggerPayload> {
  /** The unique name for this Flow. */
  name: string;
  /** A unique, unchanging value that is used to maintain identity for the Flow even if the name changes. */
  stableKey: string;
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
  schedule?: (ValueExpression<string> | ConfigVarExpression) & {
    timezone?: string;
  };
  /** Optional error handling configuration. */
  errorConfig?: StepErrorConfig;
  /** Specifies the trigger function for this Flow, which returns a payload and optional HTTP response. */
  onTrigger?:
    | TriggerReference
    | TriggerPerformFunction<
        Inputs,
        ConfigVars,
        false,
        TriggerResult<false, TTriggerPayload>
      >;
  /** Specifies the function to execute when an Instance of this Integration is deployed. */
  onInstanceDeploy?: TriggerEventFunction<Inputs, ConfigVars>;
  /** Specifies the function to execute when an Instance of an Integration is deleted. */
  onInstanceDelete?: TriggerEventFunction<Inputs, ConfigVars>;
  /** Specifies the main function for this Flow */
  onExecution: ActionPerformFunction<
    {
      onTrigger: {
        type: "data";
        label: string;
        clean: (value: unknown) => { results: TTriggerPayload };
      };
    },
    ConfigVars,
    {
      [Key in keyof ComponentRegistry]: ComponentRegistry[Key]["actions"];
    },
    false,
    ActionPerformReturn<false, unknown>
  >;
}

/** Common attribute shared by all types of Config Vars. */
type BaseConfigVar = {
  /** A unique, unchanging value that is used to maintain identity for the Config Var even if the key changes. */
  stableKey: string;
  /** Optional description for this Config Var. */
  description?: string;
  /** Optional value that specifies whether this Config Var is only configurable by Organization users. @default false  */
  orgOnly?: boolean;
  /** Optional value that specifies whether this Config Var is visible to an Organization deployer. @default true */
  visibleToOrgDeployer?: boolean;
  /** Optional value that specifies whether this Config Var is visible to a Customer deployer. @default true */
  visibleToCustomerDeployer?: boolean;
  /** Optional default value for the Config Var. */
  defaultValue?: string;
  /** Optional list of picklist values if the Config Var is a multi-choice selection value. */
  pickList?: string[];
  /** Optional value to specify the type of collection if the Config Var is multi-value. */
  collectionType?: CollectionType;
};

/** Defines attributes of a standard Config Var. */
export type StandardConfigVar = BaseConfigVar & {
  /** The data type of the Config Var. */
  dataType: Exclude<ConfigVarDataType, "schedule" | "code">;
};

export type CodeConfigVar = BaseConfigVar & {
  /** The data type of the Config Var. */
  dataType: "code";
  /** Optional default value for the Config Var. */
  defaultValue?: string;
  /** Optional value to specify the type of language if the Config Var is a code value. */
  codeLanguage?: CodeLanguageType;
};

export type ScheduleConfigVar = Omit<BaseConfigVar, "collectionType"> & {
  /** The data type of the Config Var. */
  dataType: "schedule";
  /** Optional default value for the Config Var. */
  defaultValue?: string;
  /** Optional timezone for the schedule. */
  timeZone?: string;
};

export type ComponentRegistry =
  keyof IntegrationDefinitionComponentRegistry extends never
    ? {
        [key: string]: ComponentManifest;
      }
    : UnionToIntersection<
        keyof IntegrationDefinitionComponentRegistry extends infer TComponentKey
          ? TComponentKey extends keyof IntegrationDefinitionComponentRegistry
            ? {
                [Key in TComponentKey]: IntegrationDefinitionComponentRegistry[TComponentKey];
              }
            : never
          : never
      >;

type ComponentReferenceType = Extract<
  keyof ComponentManifest,
  "actions" | "triggers" | "dataSources" | "connections"
>;

type ComponentReferenceTypeValueMap<
  TValue,
  TMap extends Record<ComponentReferenceType, unknown> = {
    actions: ValueExpression<TValue>;
    triggers: ValueExpression<TValue> | ConfigVarExpression;
    dataSources: ValueExpression<TValue> | ConfigVarExpression;
    connections: ValueExpression<TValue> | ConfigVarExpression;
  }
> = TMap;

export type ComponentReference<
  TComponentReference extends {
    component: string;
    isPublic: boolean;
    key: string;
    values?: {
      [key: string]: ValueExpression | ConfigVarExpression;
    };
    template?: string;
  } = {
    component: string;
    isPublic: boolean;
    key: string;
    values?: {
      [key: string]: ValueExpression | ConfigVarExpression;
    };
    template?: string;
  }
> = TComponentReference;

export const isComponentReference = (ref: unknown): ref is ComponentReference =>
  typeof ref === "object" && ref !== null && "key" in ref && "component" in ref;

type ComponentReferencesByType = UnionToIntersection<
  ComponentReferenceType extends infer TComponentReferenceType
    ? TComponentReferenceType extends Extract<
        keyof ComponentManifest,
        "actions" | "triggers" | "dataSources" | "connections"
      >
      ? {
          [Key in TComponentReferenceType]: keyof ComponentRegistry extends infer TComponentKey
            ? TComponentKey extends keyof ComponentRegistry
              ? TComponentKey extends string
                ? TComponentReferenceType extends keyof ComponentRegistry[TComponentKey]
                  ? keyof ComponentRegistry[TComponentKey][TComponentReferenceType] extends infer TComponentPropertyKey
                    ? TComponentPropertyKey extends keyof ComponentRegistry[TComponentKey][TComponentReferenceType]
                      ? TComponentPropertyKey extends string
                        ? "perform" extends keyof ComponentRegistry[TComponentKey][TComponentReferenceType][TComponentPropertyKey]
                          ? ComponentRegistry[TComponentKey][TComponentReferenceType][TComponentPropertyKey]["perform"] extends (
                              ...args: any[]
                            ) => any
                            ? Parameters<
                                ComponentRegistry[TComponentKey][TComponentReferenceType][TComponentPropertyKey]["perform"]
                              >[0] extends infer TInputs
                              ? ComponentReference<{
                                  component: TComponentKey;
                                  isPublic: ComponentRegistry[TComponentKey]["public"];
                                  key: TComponentPropertyKey;
                                  values: {
                                    [Key in keyof TInputs]: ComponentReferenceTypeValueMap<
                                      TInputs[Key]
                                    >[TComponentReferenceType];
                                  };
                                }>
                              : never
                            : never
                          : never
                        : never
                      : never
                    : never
                  : never
                : never
              : never
            : never;
        }
      : never
    : never
>;

export type TriggerReference = ComponentReferencesByType["triggers"];

export type ActionReference = ComponentReferencesByType["actions"];

export type DataSourceReference = ComponentReferencesByType["dataSources"];

export type ConnectionReference = ComponentReferencesByType["connections"];

// Handle some data source types not supporting collections.
type BaseDataSourceConfigVar =
  | ({
      dataSourceType: CollectionDataSourceType;
    } & BaseConfigVar)
  | ({
      dataSourceType: Exclude<DataSourceType, CollectionDataSourceType>;
    } & Omit<BaseConfigVar, "collectionType">);
type DataSourceDefinitionConfigVar = BaseDataSourceConfigVar &
  Omit<
    DataSourceDefinition<Inputs, ConfigVarResultCollection, DataSourceType>,
    | "display"
    | "inputs"
    | "examplePayload"
    | "dataSourceType"
    | "detailDataSource"
  >;
export type DataSourceReferenceConfigVar = BaseDataSourceConfigVar & {
  dataSource: DataSourceReference;
};

/** Defines attributes of a data source Config Var. */
export type DataSourceConfigVar =
  | DataSourceDefinitionConfigVar
  | DataSourceReferenceConfigVar;

type BaseConnectionConfigVar = Omit<BaseConfigVar, "collectionType"> & {
  dataType: "connection";
};

type ConnectionDefinitionConfigVar = BaseConnectionConfigVar &
  Omit<ConnectionDefinition, "label" | "comments" | "key">;
type ConnectionReferenceConfigVar = BaseConnectionConfigVar & {
  connection: ConnectionReference & {
    template?: string;
  };
};

/** Defines attributes of a Config Var that represents a Connection. */
export type ConnectionConfigVar =
  | ConnectionDefinitionConfigVar
  | ConnectionReferenceConfigVar;

export type ConfigVar =
  | StandardConfigVar
  | CodeConfigVar
  | ScheduleConfigVar
  | DataSourceConfigVar
  | ConnectionConfigVar;

export const isCodeConfigVar = (cv: ConfigVar): cv is CodeConfigVar =>
  "dataType" in cv && cv.dataType === "code";

export const isScheduleConfigVar = (cv: ConfigVar): cv is ScheduleConfigVar =>
  "dataType" in cv && cv.dataType === "schedule";

export const isDataSourceDefinitionConfigVar = (
  cv: ConfigVar
): cv is DataSourceDefinitionConfigVar =>
  "dataSourceType" in cv && "perform" in cv && typeof cv.perform === "function";

export const isDataSourceReferenceConfigVar = (
  cv: ConfigVar
): cv is DataSourceReferenceConfigVar =>
  "dataSourceType" in cv &&
  "dataSource" in cv &&
  isComponentReference(cv.dataSource);

export const isConnectionDefinitionConfigVar = (
  cv: ConfigVar
): cv is ConnectionDefinitionConfigVar =>
  "dataType" in cv && cv.dataType === "connection" && "inputs" in cv;

export const isConnectionReferenceConfigVar = (
  cv: ConfigVar
): cv is ConnectionReferenceConfigVar =>
  "connection" in cv && isComponentReference(cv.connection);

export type ConfigPageElement = string | ConfigVar;

export type ConfigPages = keyof IntegrationDefinitionConfigPages extends never
  ? { [key: string]: ConfigPage }
  : UnionToIntersection<
      keyof IntegrationDefinitionConfigPages extends infer TPageName
        ? TPageName extends keyof IntegrationDefinitionConfigPages
          ? IntegrationDefinitionConfigPages[TPageName] extends ConfigPage
            ? {
                [Key in TPageName]: IntegrationDefinitionConfigPages[TPageName];
              }
            : never
          : never
        : never
    >;

export type ConfigVars = Prettify<
  UnionToIntersection<
    keyof ConfigPages extends infer TPageName
      ? TPageName extends keyof ConfigPages
        ? ConfigPages[TPageName] extends infer TConfigPage
          ? TConfigPage extends ConfigPage
            ? {
                [Key in keyof TConfigPage["elements"] as Key extends string
                  ? TConfigPage["elements"][Key] extends ConfigVar
                    ? Key
                    : never
                  : never]: ElementToRuntimeType<TConfigPage["elements"][Key]>;
              }
            : never
          : never
        : never
      : never
  >
>;

export type ToDataSourceRuntimeType<TType extends DataSourceType> =
  TType extends "jsonForm"
    ? JSONForm
    : TType extends "objectSelection"
    ? ObjectSelection
    : TType extends "objectFieldMap"
    ? ObjectFieldMap
    : string;

export type ElementToRuntimeType<TElement extends ConfigPageElement> =
  TElement extends ConnectionConfigVar
    ? Connection
    : TElement extends DataSourceConfigVar
    ? ToDataSourceRuntimeType<TElement["dataSourceType"]>
    : TElement extends ScheduleConfigVar
    ? Schedule
    : TElement extends StandardConfigVar
    ? string
    : never;

/** Defines attributes of a Config Wizard Page used when deploying an Instance of an Integration. */
export interface ConfigPage {
  /** Elements included on this Config Page. */
  elements: Record<string, ConfigPageElement>;
  /** Specifies an optional tagline for this Config Page. */
  tagline?: string;
}

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

/** Choices of Endpoint Types that may be used by Instances of an Integration. */
export type EndpointType =
  | "flow_specific"
  | "instance_specific"
  | "shared_instance";

/** Choices of Endpoint Security Types that may be used by endpoints of a Flow. */
export type EndpointSecurityType =
  | "unsecured"
  | "customer_optional"
  | "customer_required"
  | "organization";

/** Choices of Step Error Handlers that define the behavior when a step error occurs. */
export type StepErrorHandlerType = "fail" | "ignore" | "retry";

/** Supported data types for Config Vars. */
export type ConfigVarDataType =
  | "string"
  | "date"
  | "timestamp"
  | "picklist"
  | "schedule"
  | "code"
  | "boolean"
  | "number";

/** Choices of programming languages that may be used for Config Var code values. */
export type CodeLanguageType = "json" | "xml" | "html";

/** Choices of collection types for multi-value Config Vars. */
export type CollectionType = "valuelist" | "keyvaluelist";

/** Choices of component reference types. */
export type ComponentSelectorType = "trigger" | "connection" | "dataSource";

export type ConfigVarExpression = { configVar: string };
export type ValueExpression<TValueType = unknown> = {
  value: TValueType;
};
