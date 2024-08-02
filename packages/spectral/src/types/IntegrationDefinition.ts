import {
  ActionPerformFunction,
  ActionPerformReturn,
  TriggerEventFunction,
  TriggerPerformFunction,
  Inputs,
  TriggerResult,
  TriggerPayload,
  ComponentRegistry,
  TriggerReference,
  ConfigVars,
  ConfigPages,
  UserLevelConfigPages,
  ValueExpression,
  ConfigVarExpression,
  ActionContext,
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
  /** Config Wizard Pages for this Integration. */
  configPages?: ConfigPages;
  /** User Level Config Wizard Pages for this Integration. */
  userLevelConfigPages?: UserLevelConfigPages;

  componentRegistry?: ComponentRegistry;
};

export type FlowOnExecution<TTriggerPayload extends TriggerPayload> = ActionPerformFunction<
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

export type FlowExecutionContext = ActionContext<
  ConfigVars,
  {
    [Key in keyof ComponentRegistry]: ComponentRegistry[Key]["actions"];
  }
>;

export type FlowExecutionContextActions = FlowExecutionContext["components"];

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
    | TriggerPerformFunction<Inputs, ConfigVars, false, TriggerResult<false, TTriggerPayload>>;
  /** Specifies the function to execute when an Instance of this Integration is deployed. */
  onInstanceDeploy?: TriggerEventFunction<Inputs, ConfigVars>;
  /** Specifies the function to execute when an Instance of an Integration is deleted. */
  onInstanceDelete?: TriggerEventFunction<Inputs, ConfigVars>;
  /** Specifies the main function for this Flow */
  onExecution: FlowOnExecution<TTriggerPayload>;
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
export type EndpointType = "flow_specific" | "instance_specific" | "shared_instance";

/** Choices of Endpoint Security Types that may be used by endpoints of a Flow. */
export type EndpointSecurityType =
  | "unsecured"
  | "customer_optional"
  | "customer_required"
  | "organization";

/** Choices of Step Error Handlers that define the behavior when a step error occurs. */
export type StepErrorHandlerType = "fail" | "ignore" | "retry";
