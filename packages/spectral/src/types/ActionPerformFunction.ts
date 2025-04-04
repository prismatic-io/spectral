import { AxiosRequestConfig, AxiosResponse } from "axios";
import {
  Inputs,
  ConfigVarResultCollection,
  ActionPerformReturn,
  ActionInputParameters,
  ActionLogger,
  InstanceAttributes,
  CustomerAttributes,
  UserAttributes,
  IntegrationAttributes,
  FlowAttributes,
  ComponentManifest,
} from ".";

interface StandardLineage {
  componentActionKey: string;
  executionId: string;
  executionStartedAt: string;
  stepName: string;
  loopPath: string;
}

interface CustomLineage {
  customSource: string;
}

export interface DebugContext {
  /** READ-ONLY: Denotes whether code should be executed in debug mode. */
  enabled: boolean;
  /** Helper methods for measuring how long a process takes between marks. Only runs if debug.enabled is true. */
  timeElapsed: {
    /** Creates a mark for measuring time in your process. */
    mark: (context: ActionContext, label: string) => void;
    /** Measures the time spent between two marks. The label should be a unique descriptor of this duration. */
    measure: (context: ActionContext, label: string, marks: { start: string; end: string }) => void;
  };
  /** Measures memory usage up until that point in the process. showDetail will run slower but show the full output of process.memoryUsage().
   * Only runs if debug.enabled is true. */
  memoryUsage: (context: ActionContext, label: string, showDetail?: boolean) => void;
  /** Resulting debug measurements that can be logged or saved. */
  results: DebugResult;
}

interface DebugResult {
  /** Resulting data about time measurements. */
  timeElapsed: {
    /** The set of recorded marks and their measured start times. */
    marks: Record<string, number>;
    /** The set of measured durations based on the difference in marked times. */
    measurements: Record<
      string,
      {
        marks: { start: string; end: string };
        duration: number;
      }
    >;
  };
  /** Memory limit in MB. */
  allowedMemory: number;
  /** Resulting data bout memory usage. */
  memoryUsage: Array<{
    mark: string;
    /* Memory usage in MB up until the marked point. */
    rss: number;
    /* The full result of process.memoryUsage(), converted to MB. */
    detail?: MemoryUsage;
  }>;
}

export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export type ExecutionFrame =
  | ({
      invokedByExecutionJWT: string;
      invokedByExecutionStartedAt: string;
    } & StandardLineage)
  | ({
      invokedByExecutionJWT: string;
      invokedByExecutionStartedAt: string;
    } & CustomLineage);

export type FlowInvoker<TFlows extends Readonly<string[]> | undefined> = (
  flowName: TFlows extends Readonly<string[]> ? TFlows[number] : string,
  data?: Record<string, unknown>,
  config?: AxiosRequestConfig<any>,
  source?: string,
) => Promise<AxiosResponse<any, any>>;

/** Definition of the function to perform when an Action is invoked. */
export type ActionPerformFunction<
  TInputs extends Inputs = Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TComponentActions extends Record<string, ComponentManifest["actions"]> = Record<
    string,
    ComponentManifest["actions"]
  >,
  TAllowsBranching extends boolean | undefined = undefined,
  TReturn extends ActionPerformReturn<TAllowsBranching, unknown> = ActionPerformReturn<
    TAllowsBranching,
    unknown
  >,
> = (
  context: ActionContext<TConfigVars, TComponentActions>,
  params: ActionInputParameters<TInputs>,
) => Promise<TReturn>;

/** Context provided to perform method containing helpers and contextual data. */
export type ActionContext<
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TComponentActions extends Record<string, ComponentManifest["actions"]> = Record<
    string,
    ComponentManifest["actions"]
  >,
  TFlows extends string[] = string[],
> = {
  /** Logger for permanent logging; console calls are also captured. */
  logger: ActionLogger;
  /** A a flow-specific key/value store that may be used to store small amounts of data that is persisted between Instance executions. */
  instanceState: Record<string, unknown>;
  /** A key/value store that is shared between flows on an Instance that may be used to store small amounts of data that is persisted between Instance executions. */
  crossFlowState: Record<string, unknown>;
  /** A key/value store that may be used to store small amounts of data for use later during the execution. */
  executionState: Record<string, unknown>;
  /** A key/value store that is shared between all flows of an Instance for any version of an Integration that may be used to store small amounts of data that is persisted between Instance executions. */
  integrationState: Record<string, unknown>;
  /** Key/value collection of config variables of the integration. */
  configVars: TConfigVars;
  /** Available component actions registered in the `componentRegistry`. */
  components: {
    [K in keyof TComponentActions]: {
      [A in keyof TComponentActions[K]]: TComponentActions[K][A]["perform"];
    };
  };
  /** A unique id that corresponds to the step on the Integration. */
  stepId: string;
  /** A unique id that corresponds to the specific execution of the Integration. */
  executionId: string;
  /** An object containing webhook URLs for all flows of the currently running instance. */
  webhookUrls: Record<string, string>;
  /** An object containing webhook API keys for all flows of the currently running instance. */
  webhookApiKeys: Record<string, string[]>;
  /** The URL used to invoke the current execution. */
  invokeUrl: string;
  /** Contains attributes of the Customer for whom an Instance is being executed. */
  customer: CustomerAttributes;
  /** Contains attributes of the Instance that is being executed. */
  instance: InstanceAttributes;
  /** Contains attributes of the User for whom a User Level Configuration is being used. */
  user: UserAttributes;
  /** Contains attributes of the Integration that is being executed. */
  integration: IntegrationAttributes;
  /** Contains attributes of the Flow that is being executed. */
  flow: FlowAttributes;
  /** The time in UTC that execution started. */
  startedAt: string;
  /** Function to invoke an execution of another flow. */
  invokeFlow: FlowInvoker<TFlows>;
  /** Reference to the current execution and, when applicable, the current step. */
  executionFrame: ExecutionFrame;
  /** Contains methods, flags, and data to support debug modes. */
  debug: DebugContext;
};
