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
} from "../types";

interface DisplayDefinition {
  label: string;
  description: string;
}

export { InstanceAttributes } from "../types";
export { CustomerAttributes } from "../types";
export { UserAttributes } from "../types";
export { IntegrationAttributes } from "../types";
export { FlowAttributes } from "../types";

export interface Component {
  key: string;
  public?: boolean;
  documentationUrl?: string;
  display: DisplayDefinition & { category?: string; iconPath?: string };
  actions: Record<string, Action>;
  triggers: Record<string, Trigger>;
  dataSources: Record<string, DataSource>;
  connections: Connection[];
  codeNativeIntegrationYAML?: string;
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
  TConfigVars extends ConfigVarResultCollection,
  THasConfigVars extends boolean = false
> = {
  logger: ActionLogger;
  instanceState: Record<string, unknown>;
  crossFlowState: Record<string, unknown>;
  executionState: Record<string, unknown>;
  integrationState: Record<string, unknown>;
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
} & (THasConfigVars extends true
  ? { configVars: TConfigVars }
  : Record<string, never>);

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

export type TriggerResult =
  | TriggerBranchingResult
  | TriggerBaseResult
  | undefined;

export type TriggerPerformFunction = (
  context: ActionContext<any>,
  payload: TriggerPayload,
  params: Record<string, unknown>
) => Promise<TriggerResult>;

export type TriggerEventFunctionResult = TriggerEventFunctionReturn | void;

export type TriggerEventFunction = (
  context: ActionContext<any>,
  params: Record<string, unknown>
) => Promise<TriggerEventFunctionResult>;

export interface Trigger {
  key: string;
  display: DisplayDefinition & { directions?: string; important?: boolean };
  inputs: Input[];
  terminateExecution?: boolean;
  breakLoop?: boolean;
  allowsBranching?: boolean;
  staticBranchNames?: string[];
  dynamicBranchInput?: string;
  perform: TriggerPerformFunction;
  onInstanceDeploy?: TriggerEventFunction;
  hasOnInstanceDeploy?: boolean;
  onInstanceDelete?: TriggerEventFunction;
  hasOnInstanceDelete?: boolean;
  scheduleSupport: TriggerOptionChoice;
  synchronousResponseSupport: TriggerOptionChoice;
  examplePayload?: unknown;
  isCommonTrigger?: boolean;
}

export interface DataSourceContext {
  logger: ActionLogger;
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
  params: Record<string, unknown>
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
  inputs: (Input & { shown?: boolean })[];
}

export interface ConnectionValue {
  key: string;
  configVarKey: string;
  fields: { [key: string]: unknown };
  token?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

interface ServerPerformDataStructureReturn {
  data:
    | boolean
    | number
    | string
    | Record<string, unknown>
    | unknown[]
    | unknown;
  contentType?: string;
  statusCode?: number;
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
  instanceState?: Record<string, unknown>;
  crossFlowState?: Record<string, unknown>;
  executionState?: Record<string, unknown>;
  integrationState?: Record<string, unknown>;
  failed?: boolean;
  error?: Record<string, unknown>;
}

interface ServerPerformBranchingDataStructureReturn
  extends ServerPerformDataStructureReturn {
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
  context: ActionContext<any>,
  params: Record<string, unknown>
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
}
