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
  ScopedConfigVarMap,
  FlowDefinitionFlowSchema,
} from ".";

/**
 * Defines attributes of a code-native integration. See
 * https://prismatic.io/docs/integrations/code-native/
 */
export type IntegrationDefinition = {
  /** The unique name for this integration. */
  name: string;
  /** Description for this integration. */
  description?: string;
  /** Path to icon to use for this integration. Path should be relative to the built integration source. */
  iconPath?: string;
  /** Category for this integration. */
  category?: string;
  /** Documentation for this integration. */
  documentation?: string;
  /** Version identifier for this integration. */
  version?: string;
  /** Labels for this integration. */
  labels?: string[];
  /**
   * Endpoint type used by Instances of this integration.
   * A Preprocess Flow Config must be specified when using anything other than 'Flow Specific'. See
   * https://prismatic.io/docs/integrations/code-native/endpoint-config/.
   *
   *  @default `EndpointType.FlowSpecific` */
  endpointType?: EndpointType;
  /**
   * Preprocess Flow configuration for when the Trigger payload contains the flow routing attributes.
   *  Cannot specify this if a Preprocess Flow is also configured. See
   * https://prismatic.io/docs/integrations/code-native/endpoint-config/#endpoint-configuration-in-code-native-with-preprocess-flow
   */
  triggerPreprocessFlowConfig?: PreprocessFlowConfig;
  /**
   * Flows for this integration. See
   * https://prismatic.io/docs/integrations/code-native/flows/
   */
  flows: Flow[];
  /**
   * Config wizard pages for this integration. See
   * https://prismatic.io/docs/integrations/code-native/config-wizard/
   */
  configPages?: ConfigPages;
  /**
   * User Level Config Wizard Pages for this integration. See
   * https://prismatic.io/docs/integrations/code-native/config-wizard/#user-level-config-wizards-in-code-native-integrations
   */
  userLevelConfigPages?: UserLevelConfigPages;
  /** Scoped ConfigVars for this integration. */
  scopedConfigVars?: ScopedConfigVarMap;
  /** Instance Profile used for this integration.
   * @default "Default Instance Profile"
   */
  instanceProfile?: string;
  /**
   * A list of components this code-native integration uses. See
   * https://prismatic.io/docs/integrations/code-native/existing-components/
   */
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

/** Defines attributes of a flow of a code-native integration. */
export interface Flow<TTriggerPayload extends TriggerPayload = TriggerPayload> {
  /** The unique name for this flow. */
  name: string;
  /** A unique, unchanging value that is used to maintain identity for the flow even if the name changes. */
  stableKey: string;
  /** Description for this flow. */
  description?: string;
  /**
   * Preprocess flow configuration for when the result of this flow contains the flow routing attributes.
   * Only one flow per integration may define this.
   */
  preprocessFlowConfig?: PreprocessFlowConfig;
  /** Value that specifies whether this flow is synchronous. @default `false` */
  isSynchronous?: boolean;
  /** Retry Configuration for this flow. */
  retryConfig?: RetryConfig;
  /** Queue Configuration for this flow. */
  queueConfig?: QueueConfig;
  /**
   * Security configuration to use for the endpoint of this flow.
   * @default `EndpointSecurityType.CustomerOptional`
   */
  endpointSecurityType?: EndpointSecurityType;
  /**
   * List of API key(s) to use for the endpoint of this flow
   * when the endpoint security type is `EndpointSecurityType.Organization`.
   */
  organizationApiKeys?: string[];
  /** Schedule configuration that defines the frequency with which this flow will be automatically executed. */
  schedule?: (ValueExpression<string> | ConfigVarExpression) & {
    timezone?: string;
  };
  /** Error handling configuration. */
  errorConfig?: StepErrorConfig;
  /** Optional schemas definitions for the flow. Currently only for use with AI agents. */
  schemas?: Record<string, FlowDefinitionFlowSchema> & {
    invoke: FlowDefinitionFlowSchema;
  };
  /** Specifies the trigger function for this flow, which returns a payload and optional HTTP response. */
  onTrigger?:
    | TriggerReference
    | TriggerPerformFunction<Inputs, ConfigVars, false, TriggerResult<false, TTriggerPayload>>;
  /**
   * Specifies the function to execute when an instance of this integration is deployed. See
   * https://prismatic.io/docs/custom-connectors/triggers/#instance-deploy-and-delete-events-for-triggers
   */
  onInstanceDeploy?: TriggerEventFunction<Inputs, ConfigVars>;
  /**
   * Specifies the function to execute when an instance of an integration is deleted. See
   * https://prismatic.io/docs/custom-connectors/triggers/#instance-deploy-and-delete-events-for-triggers
   */
  onInstanceDelete?: TriggerEventFunction<Inputs, ConfigVars>;
  /** Specifies the main function for this flow which is run when this flow is invoked. */
  onExecution: FlowOnExecution<TTriggerPayload>;
}

/** Defines attributes of a Preprocess flow Configuration used by a flow of an integration. */
export type PreprocessFlowConfig = {
  /** Name of the field in the data payload returned by the Preprocess flow to use for a flow Name. */
  flowNameField: string;
  /** Name of the field in the data payload returned by the Preprocess flow to use for an External Customer Id. */
  externalCustomerIdField?: string;
  /** Name of the field in the data payload returned by the Preprocess flow to use for an External Customer User Id. */
  externalCustomerUserIdField?: string;
};

/** Defines attributes of a retry configuration used by a flow of an integration. */
export type RetryConfig = {
  /** The maximum number of retry attempts. Must be between 0 and 10. */
  maxAttempts: number;
  /** The delay in minutes to wait between retry attempts. Must be between 0 and 60. */
  delayMinutes: number;
  /** Specifies whether to use exponential backoff to calculate the delay between retry attempts. */
  usesExponentialBackoff: boolean;
  /** Name of the field in the data payload returned by the flow's trigger to use as a Unique Request ID for retry request cancellation. */
  uniqueRequestIdField?: string;
};

/** Defines attributes of a retry configuration used by a flow of an integration. */
export type QueueConfig = {
  /** Determines whether the flow should be executed using FIFO ordering. */
  usesFifoQueue: boolean;
  /** Name of the field in the data payload returned by the flow's trigger to use as a dedupe ID; used to determine whether to queue the execution. */
  dedupeIdField?: string;
};

/** Defines attributes of a step error configuration used to determine how to handle errors during flow step execution. */
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

/** Choices of Endpoint Types that may be used by Instances of an integration. */
export type EndpointType = "flow_specific" | "instance_specific" | "shared_instance";

/** Choices of Endpoint Security Types that may be used by endpoints of a flow. */
export type EndpointSecurityType =
  | "unsecured"
  | "customer_optional"
  | "customer_required"
  | "organization";

/** Choices of Step Error Handlers that define the behavior when a step error occurs. */
export type StepErrorHandlerType = "fail" | "ignore" | "retry";
