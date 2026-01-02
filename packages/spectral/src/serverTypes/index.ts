/* Types used to describe the format the platform expects for
 * component and integration definitions. */

import {
  InstanceAttributes,
  CustomerAttributes,
  DataSourceType,
  DataSourceResultType,
  UserAttributes,
  TriggerEventFunctionReturn,
  IntegrationAttributes,
  FlowAttributes,
  ConfigVarResultCollection,
  ComponentManifest,
  FlowInvoker,
  ExecutionFrame,
  DebugContext,
  FlowSchemas,
  PollingTriggerPerformFunction,
  Inputs,
  TriggerResult as TriggerPerformResult,
  TriggerPerformFunction,
} from "../types";
import type { CNIPollingPerformFunction, ComponentRefTriggerPerformFunction } from "./triggerTypes";

interface DisplayDefinition {
  label: string;
  description: string;
}

export { InstanceAttributes } from "../types";
export { CustomerAttributes } from "../types";
export { UserAttributes } from "../types";
export { IntegrationAttributes } from "../types";
export { FlowAttributes } from "../types";
export { FlowSchemas } from "../types";

export interface PublishingMetadata {
  flowsWithCustomerRequiredAPIKeys: {
    name: string;
    testApiKeys?: string[];
  }[];
}

export interface Component<
  TInputs extends Inputs = Inputs,
  TActionInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
> {
  key: string;
  public?: boolean;
  documentationUrl?: string;
  display: DisplayDefinition & { category?: string; iconPath?: string };
  actions: Record<string, Action>;
  triggers: Record<
    string,
    Trigger<TInputs, TActionInputs, TConfigVars, TPayload, TAllowsBranching, TResult>
  >;
  dataSources: Record<string, DataSource>;
  connections: Connection[];
  codeNativeIntegrationYAML?: string;
  publishingMetadata?: PublishingMetadata;
}

export interface Action {
  key: string;
  display: DisplayDefinition & { directions?: string; important?: boolean };
  inputs: Input[];
  terminateExecution?: boolean;
  breakLoop?: boolean;
  allowsBranching?: boolean;
  staticBranchNames?: string[];
  dynamicBranchInput?: string;
  perform: ActionPerformFunction;
  examplePayload?: unknown;
}

export type ActionLoggerFunction = (...args: unknown[]) => void;

export interface ActionLogger {
  metric: ActionLoggerFunction;
  trace: ActionLoggerFunction;
  debug: ActionLoggerFunction;
  info: ActionLoggerFunction;
  log: ActionLoggerFunction;
  warn: ActionLoggerFunction;
  error: ActionLoggerFunction;
}

export type ActionContext<
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TComponentActions extends Record<string, ComponentManifest["actions"]> = Record<
    string,
    ComponentManifest["actions"]
  >,
  TFlows extends string[] = string[],
> = {
  logger: ActionLogger;
  instanceState: Record<string, unknown>;
  crossFlowState: Record<string, unknown>;
  executionState: Record<string, unknown>;
  integrationState: Record<string, unknown>;
  configVars: TConfigVars;
  stepId: string;
  executionId: string;
  webhookUrls: Record<string, string>;
  webhookApiKeys: Record<string, string[]>;
  invokeUrl: string;
  customer: CustomerAttributes;
  instance: InstanceAttributes;
  user: UserAttributes;
  integration: IntegrationAttributes;
  flow: FlowAttributes;
  startedAt: string;
  executionFrame: ExecutionFrame;
  flowSchemas: FlowSchemas;

  // @TODO - Hidden from the user-facing ActionContext.
  globalDebug?: boolean;
  runnerAllocatedMemoryMb?: number;

  // @TODO - Added by the Spectral layer. Separate these out eventually
  components: {
    [K in keyof TComponentActions]: {
      [A in keyof TComponentActions[K]]: TComponentActions[K][A]["perform"];
    };
  };
  invokeFlow: FlowInvoker<TFlows>;
  debug: DebugContext;
};

type TriggerOptionChoice = "invalid" | "valid" | "required";

export interface TriggerPayload {
  headers: Record<string, string>;
  queryParameters: Record<string, string>;
  rawBody: {
    data: unknown;
    contentType?: string;
  };
  body: {
    data: unknown;
    contentType?: string;
  };
  pathFragment: string;
  webhookUrls: Record<string, string>;
  webhookApiKeys: Record<string, string[]>;
  invokeUrl: string;
  executionId: string;
  customer: CustomerAttributes;
  instance: InstanceAttributes;
  user: UserAttributes;
  integration: IntegrationAttributes;
  flow: FlowAttributes;
  startedAt: string;
  globalDebug: boolean;
}

interface HttpResponse {
  statusCode: number;
  contentType: string;
  headers?: Record<string, string>;
  body?: string;
}

interface TriggerBaseResult {
  payload: TriggerPayload;
  response?: HttpResponse;
  instanceState?: Record<string, unknown>;
  crossFlowState?: Record<string, unknown>;
  executionState?: Record<string, unknown>;
  integrationState?: Record<string, unknown>;
  failed?: boolean;
  error?: Record<string, unknown>;
}

interface TriggerBranchingResult extends TriggerBaseResult {
  branch: string;
}

export type TriggerResult = TriggerBranchingResult | TriggerBaseResult | undefined;

export type TriggerEventFunctionResult = TriggerEventFunctionReturn | void;

export type TriggerEventFunction = (
  context: ActionContext,
  params: Record<string, unknown>,
) => Promise<TriggerEventFunctionResult>;

export interface Trigger<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
> {
  key: string;
  display: DisplayDefinition & { directions?: string; important?: boolean };
  inputs: Input[];
  terminateExecution?: boolean;
  breakLoop?: boolean;
  allowsBranching?: boolean;
  staticBranchNames?: string[];
  dynamicBranchInput?: string;
  perform:
    | TriggerPerformFunction<TInputs, TConfigVars, TAllowsBranching, TResult>
    | PollingTriggerPerformFunction<
        TInputs,
        TActionInputs,
        TConfigVars,
        TPayload,
        TAllowsBranching,
        TResult
      >
    | CNIPollingPerformFunction<TInputs, TConfigVars, TPayload, TAllowsBranching>
    | ComponentRefTriggerPerformFunction<TInputs, TConfigVars>;
  onInstanceDeploy?: TriggerEventFunction;
  hasOnInstanceDeploy?: boolean;
  onInstanceDelete?: TriggerEventFunction;
  hasOnInstanceDelete?: boolean;
  webhookLifecycleHandlers?: {
    create: TriggerEventFunction;
    delete: TriggerEventFunction;
  };
  webhookCreate?: TriggerEventFunction;
  hasWebhookCreateFunction?: boolean;
  webhookDelete?: TriggerEventFunction;
  hasWebhookDeleteFunction?: boolean;
  scheduleSupport: TriggerOptionChoice;
  synchronousResponseSupport: TriggerOptionChoice;
  examplePayload?: unknown;
  isCommonTrigger?: boolean;
  isPollingTrigger?: boolean;
}

export interface DataSourceContext<
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
> {
  logger: ActionLogger;
  configVars: TConfigVars;
  customer: CustomerAttributes;
  instance: InstanceAttributes;
  user: UserAttributes;
}

export type DataSourceResult = {
  result: DataSourceResultType;
  supplementalData?: { data: unknown; contentType: string };
};

export type DataSourcePerformFunction = (
  context: DataSourceContext,
  params: Record<string, unknown>,
) => Promise<DataSourceResult>;

export interface DataSource {
  key: string;
  display: DisplayDefinition & { directions?: string; important?: boolean };
  inputs: Input[];
  perform: DataSourcePerformFunction;
  dataSourceType: DataSourceType;
  examplePayload?: unknown;
}

export enum OAuth2Type {
  ClientCredentials = "client_credentials",
  AuthorizationCode = "authorization_code",
}

export interface Connection {
  key: string;
  label: string;
  comments?: string;
  oauth2Type?: OAuth2Type;
  iconPath?: string;
  avatarIconPath?: string;
  inputs: (Input & { shown?: boolean; onPremControlled?: boolean })[];
}

export interface ConnectionValue {
  key: string;
  configVarKey: string;
  fields: { [key: string]: unknown };
  token?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

interface ServerPerformDataStructureReturn {
  data: boolean | number | string | Record<string, unknown> | unknown[] | unknown;
  contentType?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  instanceState?: Record<string, unknown>;
  crossFlowState?: Record<string, unknown>;
  executionState?: Record<string, unknown>;
  integrationState?: Record<string, unknown>;
  failed?: boolean;
  error?: Record<string, unknown>;
}

interface ServerPerformDataReturn {
  data: Buffer | string | unknown;
  contentType: string;
  statusCode?: number;
  headers?: Record<string, string>;
  instanceState?: Record<string, unknown>;
  crossFlowState?: Record<string, unknown>;
  executionState?: Record<string, unknown>;
  integrationState?: Record<string, unknown>;
  failed?: boolean;
  error?: Record<string, unknown>;
}

interface ServerPerformBranchingDataStructureReturn extends ServerPerformDataStructureReturn {
  branch: string;
}

interface ServerPerformBranchingDataReturn extends ServerPerformDataReturn {
  branch: string;
}

export type ActionPerformReturn =
  | ServerPerformDataStructureReturn
  | ServerPerformBranchingDataStructureReturn
  | ServerPerformDataReturn
  | ServerPerformBranchingDataReturn
  | undefined; // Allow an action to return nothing to reduce component implementation boilerplate

export type ActionPerformFunction = (
  context: ActionContext,
  params: Record<string, unknown>,
) => Promise<ActionPerformReturn>;

interface InputFieldChoice {
  label: string;
  value: string;
}

export interface Input {
  key: string;
  label: string;
  keyLabel?: string;
  type: string;
  collection?: string;
  placeholder?: string;
  default?: unknown;
  comments?: string;
  example?: string;
  required?: boolean;
  model?: InputFieldChoice[];
  language?: string;
  onPremiseControlled?: boolean;
  dataSource?: string;
  shown?: boolean;
}

export * from "./asyncContext";
