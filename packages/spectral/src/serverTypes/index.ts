interface DisplayDefinition {
  label: string;
  description: string;
}

interface Component {
  key: string;
  public?: boolean;
  documentationUrl?: string;
  display: DisplayDefinition & { category?: string; iconPath?: string };
  actions: Record<string, Action>;
  triggers: Record<string, Trigger>;
  connections: Connection[];
}

interface Action {
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

type ActionLoggerFunction = (...args: unknown[]) => void;

interface ActionLogger {
  metric: ActionLoggerFunction;
  trace: ActionLoggerFunction;
  debug: ActionLoggerFunction;
  info: ActionLoggerFunction;
  log: ActionLoggerFunction;
  warn: ActionLoggerFunction;
  error: ActionLoggerFunction;
}

interface ActionContext {
  logger: ActionLogger;
  instanceState: Record<string, unknown>;
  executionState: Record<string, unknown>;
  stepId: string;
  executionId: string;
}

type TriggerOptionChoice = "invalid" | "valid" | "required";

interface TriggerPayload {
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
  webhookUrls: Record<string, string>;
  webhookApiKeys: Record<string, string[]>;
  invokeUrl: string;
  executionId: string;
  customer: {
    id: string | null;
    externalId: string | null;
    name: string | null;
  };
  instance: {
    id: string | null;
    name: string | null;
  };
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
  executionState?: Record<string, unknown>;
}

interface TriggerBranchingResult extends TriggerBaseResult {
  branch: string;
}

type TriggerResult = TriggerBranchingResult | TriggerBaseResult | undefined;

type TriggerPerformFunction = (
  context: ActionContext,
  payload: TriggerPayload,
  params: Record<string, unknown>
) => Promise<TriggerResult>;

interface Trigger {
  key: string;
  display: DisplayDefinition & { directions?: string; important?: boolean };
  inputs: Input[];
  terminateExecution?: boolean;
  breakLoop?: boolean;
  allowsBranching?: boolean;
  staticBranchNames?: string[];
  dynamicBranchInput?: string;
  perform: TriggerPerformFunction;
  scheduleSupport: TriggerOptionChoice;
  synchronousResponseSupport: TriggerOptionChoice;
  examplePayload?: unknown;
  isCommonTrigger?: boolean;
}

enum OAuth2Type {
  ClientCredentials = "client_credentials",
  AuthorizationCode = "authorization_code",
}

interface Connection {
  key: string;
  label: string;
  comments?: string;
  oauth2Type?: OAuth2Type;
  iconPath?: string;
  inputs: (Input & { shown?: boolean })[];
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
  executionState?: Record<string, unknown>;
}

interface ServerPerformDataReturn {
  data: Buffer | string | unknown;
  contentType: string;
  statusCode?: number;
  instanceState?: Record<string, unknown>;
  executionState?: Record<string, unknown>;
}

interface ServerPerformBranchingDataStructureReturn
  extends ServerPerformDataStructureReturn {
  branch: string;
}

interface ServerPerformBranchingDataReturn extends ServerPerformDataReturn {
  branch: string;
}

type ActionPerformReturn =
  | ServerPerformDataStructureReturn
  | ServerPerformBranchingDataStructureReturn
  | ServerPerformDataReturn
  | ServerPerformBranchingDataReturn
  | undefined; // Allow an action to return nothing to reduce component implementation boilerplate

type ActionPerformFunction = (
  context: ActionContext,
  params: Record<string, unknown>
) => Promise<ActionPerformReturn>;

interface InputFieldChoice {
  label: string;
  value: string;
}

interface Input {
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

export type { Component, Trigger, Action, Connection, Input };
