import type { ActionContext, ActionPerformFunction } from "./ActionPerformFunction";
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
import type { HttpResponse } from "./HttpResponse";
import type { Inputs } from "./Inputs";
import type { PollingTriggerPerformFunction } from "./PollingTriggerDefinition";
import type { ScopedConfigVarMap } from "./ScopedConfigVars";
import type { BatchConfig } from "./TriggerDefinition";
import type { TriggerEventFunction } from "./TriggerEventFunction";
import type { TriggerPayload } from "./TriggerPayload";
import type { TriggerPerformFunction } from "./TriggerPerformFunction";
import type { TriggerResult } from "./TriggerResult";

/**
 * Defines attributes of a code-native integration. See
 * https://prismatic.io/docs/integrations/code-native/
 */
export type IntegrationDefinition<
  TInputs extends Inputs = Inputs,
  TActionInputs extends Inputs = Inputs,
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
   *
   * The trailing `any`s for `TItem`/`TDiscoveryState`/`TTriggerPayload` let flows with
   * different resolver item and cursor types live in one array. `integration` only holds
   * and serializes these flows (it never invokes `onExecution`), so the precise — and
   * per-flow distinct — `onExecution` param type does not need to be preserved here.
   */
  flows: Flow<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult, any, any, any>[];
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
   * If not specified, the tenant's default Instance Profile will be used.
   */
  instanceProfile?: string;
  /**
   * A list of components this code-native integration uses. See
   * https://prismatic.io/docs/integrations/code-native/existing-components/
   */
  componentRegistry?: ComponentRegistry;
};

/**
 * The trigger payload as `onExecution` sees it. When a `triggerResolver` is in
 * play, the platform replaces `body.data` with this execution's batch slice —
 * a single `TItem` when `batchSize` is 1, otherwise a `TItem[]`. When no item
 * type is known (`TItem` defaults to `unknown`), the payload is left untouched.
 */
export type BatchedTriggerPayload<TPayload extends TriggerPayload, TItem> = unknown extends TItem
  ? TPayload
  : Omit<TPayload, "body"> & { body: { data: TItem | TItem[]; contentType?: string } };

/**
 * The page of records a batched trigger fire (`onTrigger`/`onDeploy`) returns. The author
 * returns the items plus, when paginating, the cursor for the next page, spectral
 * wraps the items into the wire trigger payload (`body.data`), stamps `discoveryState` onto it,
 * and synthesizes the resolver that reads both back. There is no separate pagination callback to define.
 */
export interface BatchedTriggerReturn<
  TItem,
  TPaginationState extends Record<string, unknown> = Record<string, unknown>,
> {
  /** The records produced by this trigger fire. Chunked into batches of the flow's `batchConfig.batchSize`. */
  items: TItem[];
  /**
   * Cursor for the next page. Return it to paginate — the fire is re-invoked with this object on
   * `payload.discoveryState`. Omit or return `null` to stop. Compute it here from the fetch
   * response, where the next-page token is still in scope.
   */
  discoveryState?: TPaginationState | null;
  /** Optional HTTP response to the request that invoked the integration. */
  response?: HttpResponse;
}

/**
 * A batched trigger built by {@link batchFlowTrigger}. Bundles the normal and on-deploy trigger
 * fires, each returning `{ items, discoveryState? }`. The two type parameters — supplied
 * explicitly to `batchFlowTrigger<TItem, TPaginationState>(...)` — flow through to the rest of
 * the flow: `TItem` types `onExecution`'s `params.onTrigger.results.body.data`, and
 * `TPaginationState` types both `payload.discoveryState` (read on the way in) and the
 * `discoveryState` each fire returns (the next page's cursor).
 */
export interface BatchTrigger<
  TItem,
  TPaginationState extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * The trigger function for this flow. Fetches a page of records and returns them as `items`,
   * plus the next page's `discoveryState` to paginate (omit/`null` to stop). Read the cursor for
   * the current page from `payload.discoveryState`.
   */
  onTrigger: (
    context: ActionContext<ConfigVars>,
    payload: TriggerPayload<TPaginationState>,
  ) => Promise<BatchedTriggerReturn<TItem, TPaginationState>>;
  /**
   * The on-deploy trigger fire, run once on initial instance deploy. Same shape as `onTrigger`;
   * return `discoveryState` to paginate the backfill.
   */
  onDeploy?: (
    context: ActionContext<ConfigVars>,
    payload: TriggerPayload<TPaginationState>,
  ) => Promise<BatchedTriggerReturn<TItem, TPaginationState>>;
}

export type FlowOnExecution<
  TTriggerPayload extends TriggerPayload,
  TItem = unknown,
> = ActionPerformFunction<
  {
    onTrigger: {
      type: "data";
      label: string;
      clean: (value: unknown) => { results: BatchedTriggerPayload<TTriggerPayload, TItem> };
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

/**
 * The batch-discriminated fields of a flow. A flow either batches or it does not, and
 * the presence of `batchConfig` is the discriminant TypeScript uses to choose a member:
 *
 * - {@link BatchFields}: `batchConfig` is present, which requires a batched `trigger`
 *   (built with {@link batchFlowTrigger}). The flat `onTrigger`/`onDeployTrigger` are
 *   forbidden — the trigger fires live inside the `trigger` object.
 * - {@link NonBatchFields}: `batchConfig`/`trigger` are absent; the flow uses the plain
 *   `onTrigger`/`onDeployTrigger` on its variant.
 *
 * Discrimination is structural — it depends only on whether the object literal you write
 * has a `batchConfig` key — so it works without TypeScript having to infer any type
 * parameter from the value. The batched-vs-not shape of `onExecution`'s payload is handled
 * separately, on `FlowBase`, via `TItem`: when a `trigger` is present `TItem` is inferred
 * (so `onExecution` sees `TItem | TItem[]`); otherwise it stays `unknown` and the payload
 * is left untouched (see {@link BatchedTriggerPayload}). Keeping `onExecution` out of this
 * union is deliberate — a function property living in a union member loses contextual
 * parameter typing, which would make `onExecution`'s `context`/`params` implicitly `any`.
 */
interface BatchFields<TItem, TDiscoveryState extends Record<string, unknown>> {
  /**
   * Batch-dispatch config for this flow. Items returned by the `trigger`'s fires are chunked
   * into batches of `batchSize`. For a CNI flow this value is authoritative (what's written
   * here is what's used). Its presence requires a batched `trigger`.
   */
  batchConfig: BatchConfig;
  /**
   * The batched trigger for this flow, built with {@link batchFlowTrigger}. Its fires
   * (`onTrigger`/`onDeploy`) return just `items`; spectral synthesizes the resolver that
   * extracts them and maps the pagination callbacks. Required when `batchConfig` is set.
   */
  trigger: BatchTrigger<TItem, TDiscoveryState>;
  /** A batched flow's trigger fires live inside `trigger`; the flat `onTrigger` is forbidden. */
  onTrigger?: never;
  /** A batched flow's on-deploy fire lives inside `trigger`; the flat `onDeployTrigger` is forbidden. */
  onDeployTrigger?: never;
}

interface NonBatchFields {
  /** A non-batching flow may not declare batch config. */
  batchConfig?: never;
  /** A non-batching flow may not declare a batched trigger. */
  trigger?: never;
}

/**
 * The discriminated union coupling `batchConfig` and the batched `trigger`. Intersected
 * into each flow variant at {@link Flow}.
 */
type BatchDiscriminant<TItem, TDiscoveryState extends Record<string, unknown>> =
  | BatchFields<TItem, TDiscoveryState>
  | NonBatchFields;

/** Base properties shared by all flow types. */
interface FlowBase<TTriggerPayload extends TriggerPayload = TriggerPayload, TItem = unknown> {
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
  /**
   * Optional webhook lifecycle handlers for create and delete operations. See
   * https://prismatic.io/docs/custom-connectors/triggers/#webhook-lifecycle-events
   */
  webhookLifecycleHandlers?: {
    /** Function to execute to configure a webhook. */
    create: TriggerEventFunction<Inputs, ConfigVars>;
    /** Function to execute for webhook teardown. */
    delete: TriggerEventFunction<Inputs, ConfigVars>;
  };
  /**
   * Specifies the main function for this flow which is run when this flow is invoked.
   * When the flow batches (has a `triggerResolver`/`onDeployResolver`, so `TItem` is
   * inferred), `params.onTrigger.results.body.data` is typed as the resolved item type
   * (`TItem | TItem[]`); otherwise the trigger payload is left untouched.
   */
  onExecution: FlowOnExecution<TTriggerPayload, TItem>;
}

export type StandardTriggerType = "standard";

/** A standard flow with a webhook or scheduled trigger (non-polling). */
interface StandardFlow<
  TInputs extends Inputs = Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = false,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
  TTriggerPayload extends TriggerPayload = TriggerPayload,
  TItem = unknown,
  TDiscoveryState extends Record<string, unknown> = Record<string, unknown>,
> extends FlowBase<TTriggerPayload, TItem> {
  triggerType?: StandardTriggerType;
  /** Schedule configuration that defines the frequency with which this flow will be automatically executed. */
  schedule?: (ValueExpression<string> | ConfigVarExpression) & {
    timezone?: string;
  };
  /** Specifies the trigger function for this flow, which returns a payload and optional HTTP response. */
  onTrigger?:
    | TriggerReference
    | TriggerPerformFunction<TInputs, ConfigVars, TAllowsBranching, TResult, TDiscoveryState>;
  /**
   * Function to execute on initial instance deploy, in addition to (and independent of) `onTrigger`.
   * Typically used to backfill baseline records for systems whose webhooks only emit future events.
   */
  onDeployTrigger?: TriggerPerformFunction<
    TInputs,
    ConfigVars,
    TAllowsBranching,
    TResult,
    TDiscoveryState
  >;
}

export type PollingTriggerType = "polling";

/** A polling flow that runs on a schedule and has access to polling context (getState/setState). */
interface PollingFlow<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
  TTriggerPayload extends TriggerPayload = TriggerPayload,
  TItem = unknown,
  TDiscoveryState extends Record<string, unknown> = Record<string, unknown>,
> extends FlowBase<TTriggerPayload, TItem> {
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
    ConfigVars,
    TPayload,
    TAllowsBranching,
    TResult
  >;
  /**
   * Function to execute on initial instance deploy, in addition to (and independent of) `onTrigger`.
   * Typically used to backfill baseline records for systems whose webhooks only emit future events.
   */
  onDeployTrigger?: TriggerPerformFunction<
    TInputs,
    ConfigVars,
    TAllowsBranching,
    TResult,
    TDiscoveryState
  >;
}

/** Defines attributes of a flow of a code-native integration. */
export type Flow<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
  TTriggerPayload extends TriggerPayload = TriggerPayload,
  TItem = unknown,
  TDiscoveryState extends Record<string, unknown> = Record<string, unknown>,
> =
  | (StandardFlow<
      TInputs,
      TPayload,
      TAllowsBranching,
      TResult,
      TTriggerPayload,
      TItem,
      TDiscoveryState
    > &
      BatchDiscriminant<TItem, TDiscoveryState>)
  | (PollingFlow<
      TInputs,
      TActionInputs,
      TPayload,
      TAllowsBranching,
      TResult,
      TTriggerPayload,
      TItem,
      TDiscoveryState
    > &
      BatchDiscriminant<TItem, TDiscoveryState>);

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
export type StandardQueueConfig = {
  /** Determines whether the flow should be executed using FIFO ordering. Not valid for synchronous or scheduled flows. */
  usesFifoQueue?: boolean;
  /** Reference to the field in the flow's trigger return payload; used to determine whether to queue the execution. */
  dedupeIdField?: string;
  /** Determines whether the flow should be setup for singleton executions. Only valid for scheduled/polling trigger-based flows. */
  singletonExecutions?: boolean;
  /** The maximum number of concurrent executions for this flow. Must be between 2 and 15. */
  concurrencyLimit?: number;
};

export type ParallelQueueConfig = {
  /** No limits. All requests processed simultaneously. */
  type: "parallel";
};

export type ThrottledQueueConfig = {
  /** Set the max concurrent executions per instance. */
  type: "throttled";
  /** The maximum number of concurrent executions for this flow. Must be between 2 and 15. */
  concurrencyLimit?: number;
  /** Reference to the field in the flow's trigger return payload; used to determine whether to queue the execution. */
  dedupeIdField?: string;
};

export type SequentialQueueConfig = {
  /** Processed one at a time, in order received. */
  type: "sequential";
  /** Reference to the field in the flow's trigger return payload; used to determine whether to queue the execution. */
  dedupeIdField?: string;
};

export type QueueConfig =
  | ParallelQueueConfig
  | ThrottledQueueConfig
  | SequentialQueueConfig
  | StandardQueueConfig;

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
