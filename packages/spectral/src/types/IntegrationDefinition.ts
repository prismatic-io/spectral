import type { ActionContext, ActionPerformFunction } from "./ActionPerformFunction";
import type { ActionInputParameters } from "./ActionInputParameters";
import type { ActionPerformReturn } from "./ActionPerformReturn";
import type {
  ComponentRegistry,
  ConfigVarExpression,
  TriggerReference,
  ValueExpression,
} from "./ComponentRegistry";
import type { ConfigPages, UserLevelConfigPages } from "./ConfigPages";
import type { ConfigVars } from "./ConfigVars";
import type { FlowDefinitionFlowSchema } from "./FlowSchemas";
import type { ConfigVarResultCollection, Inputs } from "./Inputs";
import type { PollingTriggerPerformFunction } from "./PollingTriggerDefinition";
import type { ScopedConfigVarMap } from "./ScopedConfigVars";
import type { TriggerEventFunction } from "./TriggerEventFunction";
import type { TriggerPayload } from "./TriggerPayload";
import type { TriggerPerformFunction } from "./TriggerPerformFunction";
import type { TriggerResult } from "./TriggerResult";

/**
 * Defines attributes of a code-native integration. See
 * https://prismatic.io/docs/integrations/code-native/
 */
export type IntegrationDefinition<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
> = {
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
  flows: Flow<TInputs, TActionInputs, TConfigVars, TPayload, TAllowsBranching, TResult>[];
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

/** Base properties shared by all flow types. */
interface FlowBase<TTriggerPayload extends TriggerPayload = TriggerPayload> {
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
  /** Value that specifies whether this flow is an AI agent flow on the integrations MCP server. @default `false` */
  isAgentFlow?: boolean;
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
  testApiKeys?: string[];
  /** Error handling configuration. */
  errorConfig?: StepErrorConfig;
  /** Optional schemas definitions for the flow. Currently only for use with AI agents. */
  schemas?: Record<string, FlowDefinitionFlowSchema> & {
    invoke: FlowDefinitionFlowSchema;
  };
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

export type StandardTriggerType = "standard";

/** A standard flow with a webhook or scheduled trigger (non-polling). */
interface StandardFlow<
  TInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = false,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
  TTriggerPayload extends TriggerPayload = TriggerPayload,
> extends FlowBase<TTriggerPayload> {
  triggerType?: StandardTriggerType;
  /** Schedule configuration that defines the frequency with which this flow will be automatically executed. */
  schedule?: (ValueExpression<string> | ConfigVarExpression) & {
    timezone?: string;
  };
  /** Specifies the trigger function for this flow, which returns a payload and optional HTTP response. */
  onTrigger?:
    | TriggerReference
    | TriggerPerformFunction<TInputs, TConfigVars, TAllowsBranching, TResult>;
}

export type PollingTriggerType = "polling";

/** A polling flow that runs on a schedule and has access to polling context (getState/setState). */
interface PollingFlow<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
  TTriggerPayload extends TriggerPayload = TriggerPayload,
> extends FlowBase<TTriggerPayload> {
  /**
   * Type of trigger for this flow. A "polling" trigger runs on a schedule
   * and can use context.polling.* functions. Requires schedule to be set.
   */
  triggerType: PollingTriggerType;
  /** Schedule configuration that defines the frequency with which this flow will be automatically executed. Required for polling triggers. */
  schedule: (ValueExpression<string> | ConfigVarExpression) & {
    timezone?: string;
  };
  /**
   * Specifies the trigger function for this flow.
   */
  onTrigger: PollingTriggerPerformFunction<
    TInputs,
    TActionInputs,
    TConfigVars,
    TPayload,
    TAllowsBranching,
    TResult
  >;
}

/** Defines attributes of a flow of a code-native integration. */
export type Flow<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
  TTriggerPayload extends TriggerPayload = TriggerPayload,
> =
  | StandardFlow<TInputs, TConfigVars, TPayload, TAllowsBranching, TResult, TTriggerPayload>
  | PollingFlow<
      TInputs,
      TActionInputs,
      TConfigVars,
      TPayload,
      TAllowsBranching,
      TResult,
      TTriggerPayload
    >;

export type FlowTriggerType = PollingTriggerType | StandardTriggerType;

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

/** Defines attributes of a queue configuration used by a flow of an integration. */
export type QueueConfig = {
  /** Determines whether the flow should be executed using FIFO ordering. Not valid for synchronous or scheduled flows. */
  usesFifoQueue?: boolean;
  /** Reference to the field in the flow's trigger return payload; used to determine whether to queue the execution. */
  dedupeIdField?: string;
  /** Determines whether the flow should be setup for singleton executions. Only valid for scheduled/polling trigger-based flows. */
  singletonExecutions?: boolean;
  /** The maximum number of concurrent executions for this flow. Must be between 2 and 10. */
  concurrencyLimit?: number;
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
