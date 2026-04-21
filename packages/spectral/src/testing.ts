/**
 * This module provides functions to help developers unit
 * test custom components prior to publishing them. For
 * information on unit testing, check out our docs:
 * https://prismatic.io/docs/custom-connectors/unit-testing/
 */

import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { spyOn } from "jest-mock";
import type {
  ActionLogger,
  ActionLoggerFunction,
  Component,
  ConnectionValue,
  DataSourceContext,
  DataSourceResult,
  Input,
  ActionPerformReturn as ServerActionPerformReturn,
  TriggerPayload,
  TriggerResult,
} from "./serverTypes";
import type {
  ActionContext,
  ActionDefinition,
  ActionInputParameters,
  ComponentManifest,
  ConfigVarResultCollection,
  ConnectionDefinition,
  DataSourceDefinition,
  DataSourceType,
  Flow,
  Inputs,
  ActionPerformReturn as InvokeActionPerformReturn,
  DataSourceResult as InvokeDataSourceResult,
  TriggerResult as InvokeTriggerResult,
  TriggerDefinition,
  TriggerEventFunctionReturn,
} from "./types";

/**
 * Create a test connection to use when testing your custom component locally.
 * This builds a `ConnectionValue` from your connection definition and
 * test credential values.
 *
 * @param connectionDef The connection definition (only `key` is used).
 * @param values A record of field values for the connection (e.g. `apiKey`, `baseUrl`).
 * @param tokenValues Optional OAuth 2.0 token values (e.g. `access_token`, `refresh_token`).
 * @param displayName Optional display name for the connection config variable.
 * @returns A `ConnectionValue` object suitable for use in test invocations.
 * @see {@link https://prismatic.io/docs/custom-connectors/unit-testing/#providing-test-connection-inputs-to-an-action-test | Test Connection Inputs}
 * @example
 * import { testing } from "@prismatic-io/spectral";
 * import { apiKeyConnection } from "./connections";
 *
 * const testConnection = testing.createConnection(apiKeyConnection, {
 *   apiKey: "test-api-key-123",
 *   baseUrl: "https://api.acme.com/v2",
 * });
 *
 * // Use with testing.invoke()
 * const { result } = await testing.invoke(myAction, {
 *   connection: testConnection,
 * });
 */
export const createConnection = <T extends ConnectionDefinition>(
  { key }: T,
  values: Record<string, unknown>,
  tokenValues?: Record<string, unknown>,
  displayName?: string,
): ConnectionValue => ({
  configVarKey: displayName ?? "",
  key,
  fields: values,
  token: tokenValues,
});

export const defaultConnectionValueEnvironmentVariable = "PRISMATIC_CONNECTION_VALUE";

/**
 * Source a test connection from an environment variable for local testing.
 * The environment variable should contain a JSON-serialized connection value.
 * Defaults to reading from `PRISMATIC_CONNECTION_VALUE`.
 *
 * @param envVarKey The name of the environment variable to read. Defaults to `"PRISMATIC_CONNECTION_VALUE"`.
 * @returns A `ConnectionValue` parsed from the environment variable.
 * @see {@link https://prismatic.io/docs/custom-connectors/unit-testing/#access-connections-for-local-testing | Access Connections for Local Testing}
 * @example
 * import { testing } from "@prismatic-io/spectral";
 *
 * // Reads from PRISMATIC_CONNECTION_VALUE env var (default)
 * const conn = testing.connectionValue();
 *
 * // Or specify a custom env var
 * const conn = testing.connectionValue("MY_ACME_CONNECTION");
 */
export const connectionValue = (
  envVarKey = defaultConnectionValueEnvironmentVariable,
): ConnectionValue => {
  const value = process.env[envVarKey];
  if (!value) {
    throw new Error("Unable to find connection value.");
  }
  const result: ConnectionValue = {
    ...JSON.parse(value),
    key: "",
  };
  return result;
};

/**
 * Pre-built mock of ActionLogger. All log methods (`info`, `warn`, `error`, etc.)
 * are Jest spies, so you can assert that your actions log the expected messages.
 *
 * @returns A mock `ActionLogger` with Jest spy methods.
 * @see {@link https://prismatic.io/docs/custom-connectors/unit-testing/#verifying-correct-logging-in-action-tests | Verifying Logging}
 * @example
 * import { testing } from "@prismatic-io/spectral";
 *
 * const logger = testing.loggerMock();
 * // Pass logger in context, then assert:
 * expect(logger.info).toHaveBeenCalledWith("Processing started");
 */
export const loggerMock = (): ActionLogger => ({
  metric: console.log as ActionLoggerFunction,
  trace: spyOn(console, "trace") as unknown as ActionLoggerFunction,
  debug: spyOn(console, "debug") as unknown as ActionLoggerFunction,
  info: spyOn(console, "info") as unknown as ActionLoggerFunction,
  log: spyOn(console, "log") as unknown as ActionLoggerFunction,
  warn: spyOn(console, "warn") as unknown as ActionLoggerFunction,
  error: spyOn(console, "error") as unknown as ActionLoggerFunction,
});

async function invokeFlowTest(
  _flowName: string,
  _data?: Record<string, unknown>,
  _config?: AxiosRequestConfig<any>,
) {
  return Promise.resolve({} as AxiosResponse<any, any>);
}

/**
 * Creates basic component action mocks based on a code-native integration's
 * component registry. Each action mock returns the action's `examplePayload`
 * by default. Pass overrides in the second argument to customize specific mocks.
 *
 * @param registry The component registry (or subset) to mock.
 * @param mocks Optional overrides for specific component actions.
 * @returns An object of mocked component actions, suitable for use in test context.
 * @see {@link https://prismatic.io/docs/custom-connectors/unit-testing/ | Unit Testing}
 * @example
 * import { createMockContextComponents } from "@prismatic-io/spectral/dist/testing";
 * import { componentRegistry } from "./componentRegistry";
 *
 * // Default mocks (uses examplePayload from the manifest)
 * const components = createMockContextComponents(componentRegistry);
 *
 * // With custom overrides
 * const components = createMockContextComponents(componentRegistry, {
 *   actions: {
 *     slack: {
 *       postMessage: () => Promise.resolve({ data: { ok: true } }),
 *     },
 *   },
 * });
 */
export const createMockContextComponents = <TMockAction extends () => Promise<any>>(
  registry: Record<string, { actions: ComponentManifest["actions"] }>,
  mocks: {
    actions: Record<string, Record<string, TMockAction>>;
  } = { actions: {} },
) => {
  const components = Object.keys(registry).reduce<Record<string, Record<string, TMockAction>>>(
    (accum, componentKey) => {
      const mockActions = Object.keys(registry[componentKey].actions).reduce<
        Record<string, TMockAction>
      >((actionAccum, actionKey) => {
        actionAccum[actionKey] = (() => {
          const response = registry[componentKey].actions[actionKey].examplePayload ?? {
            data: null,
          };
          return Promise.resolve(response);
        }) as TMockAction;
        return actionAccum;
      }, {});

      accum[componentKey] = { ...mockActions, ...(mocks.actions[componentKey] ?? {}) };
      return accum;
    },
    {},
  );

  return components;
};

const createActionContext = <
  TConfigVars extends ConfigVarResultCollection,
  TComponentActions extends Record<string, ComponentManifest["actions"]> = Record<
    string,
    ComponentManifest["actions"]
  >,
>(
  context?: Partial<ActionContext<TConfigVars>>,
): ActionContext<TConfigVars, TComponentActions> => {
  return {
    logger: loggerMock(),
    instanceState: {},
    crossFlowState: {},
    executionState: {},
    integrationState: {},
    configVars: {} as ActionContext<TConfigVars, TComponentActions>["configVars"],
    components: {} as unknown as any,
    stepId: "mockStepId",
    executionId: "mockExecutionId",
    webhookUrls: {
      "Flow 1": "https://example.com",
    },
    webhookApiKeys: {
      "Flow 1": ["example-123", "example-456"],
    },
    invokeUrl: "https://example.com",
    customer: {
      id: "customerId",
      name: "Customer 1",
      externalId: "1234",
    },
    instance: {
      id: "instanceId",
      name: "Instance 1",
    },
    user: {
      id: "userId",
      email: "user@example.com",
      name: "User 1",
      externalId: "1234",
    },
    integration: {
      id: "integrationId",
      name: "Integration 1",
      versionSequenceId: "1234",
      externalVersion: "1.0.0",
    },
    flow: {
      id: "flowId",
      name: "Flow 1",
      stableId: "flowStableId",
    },
    startedAt: new Date().toISOString(),
    invokeFlow: invokeFlowTest,
    executionFrame: {
      invokedByExecutionJWT: "some-jwt",
      invokedByExecutionStartedAt: "00-00-0000",
      componentActionKey: "my-component-action-key",
      executionId: "abc-123",
      executionStartedAt: "",
      stepName: "some-step",
      loopPath: "",
    },
    debug: {
      enabled: false,
      timeElapsed: {
        mark: (_context: ActionContext, _label: string) => {},
        measure: (
          _context: ActionContext,
          _label: string,
          _marks: { start: string; end: string },
        ) => {},
      },
      memoryUsage: (_context: ActionContext, _label: string, _showDetail?: boolean) => {},
      results: {
        timeElapsed: { marks: {}, measurements: {} },
        memoryUsage: [],
        allowedMemory: 1024,
      },
    },
    flowSchemas: {},
    ...context,
  };
};

const createDataSourceContext = <TConfigVars extends ConfigVarResultCollection>(
  context?: Partial<DataSourceContext<TConfigVars>>,
): DataSourceContext<TConfigVars> => {
  return {
    logger: loggerMock(),
    configVars: {} as DataSourceContext<TConfigVars>["configVars"],
    customer: {
      id: "customerId",
      name: "Customer 1",
      externalId: "1234",
    },
    instance: {
      id: "instanceId",
      name: "Instance 1",
    },
    user: {
      id: "userId",
      email: "example@email.com",
      externalId: "1234",
      name: "Example",
    },
    ...context,
  };
};

/**
 * The type of data returned by an `invoke()` function used for unit testing component actions and triggers.
 */
interface InvokeReturn<ReturnData> {
  result: ReturnData;
  loggerMock: ActionLogger;
}

/**
 * Invokes a custom component action's `perform` function within a test harness.
 * Returns both the action result and a mock logger for asserting logging behavior.
 *
 * @param actionDef The action definition to test (only `perform` is used).
 * @param params Input parameter values to pass to the action's `perform` function.
 * @param context Optional partial context overrides (e.g. custom `configVars` or `instanceState`).
 * @returns An object with `result` (the action's return value) and `loggerMock` (for asserting logs).
 * @see {@link https://prismatic.io/docs/custom-connectors/unit-testing/ | Unit Testing}
 * @example
 * import { testing } from "@prismatic-io/spectral";
 * import { myAction } from "./actions";
 *
 * it("should return items", async () => {
 *   const { result, loggerMock } = await testing.invoke(myAction, {
 *     connection: testConnection,
 *     limit: "10",
 *   });
 *
 *   expect(result.data).toHaveProperty("items");
 *   expect(loggerMock.info).toHaveBeenCalled();
 * });
 */
export const invoke = async <
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TAllowsBranching extends boolean,
  TReturn extends InvokeActionPerformReturn<TAllowsBranching, unknown>,
>(
  { perform }: ActionDefinition<TInputs, TConfigVars, TAllowsBranching, TReturn>,
  params: ActionInputParameters<TInputs>,
  context?: Partial<ActionContext<TConfigVars>>,
): Promise<InvokeReturn<TReturn>> => {
  const realizedContext = createActionContext(context);
  const result = await perform(realizedContext, params);

  return {
    result,
    loggerMock: realizedContext.logger,
  };
};

export const defaultTriggerPayload = (): TriggerPayload => {
  const payloadData = { foo: "bar" };
  const contentType = "application/json";

  return {
    headers: {
      "content-type": contentType,
    },
    queryParameters: {},
    rawBody: {
      data: payloadData,
      contentType,
    },
    body: {
      data: JSON.stringify(payloadData),
      contentType,
    },
    pathFragment: "",
    webhookUrls: {
      "Flow 1": "https://example.com",
    },
    webhookApiKeys: {
      "Flow 1": ["example-123", "example-456"],
    },
    invokeUrl: "https://example.com",
    executionId: "executionId",
    customer: {
      id: "customerId",
      name: "Customer 1",
      externalId: "1234",
    },
    instance: {
      id: "instanceId",
      name: "Instance 1",
    },
    user: {
      id: "userId",
      email: "user@example.com",
      name: "User 1",
      externalId: "1234",
    },
    integration: {
      id: "integrationId",
      name: "Integration 1",
      versionSequenceId: "1234",
      externalVersion: "1.0.0",
    },
    flow: {
      id: "flowId",
      name: "Flow 1",
      stableId: "flowStableId",
    },
    startedAt: new Date().toISOString(),
    globalDebug: false,
  };
};

/**
 * Invokes a custom component trigger's `perform` function within a test harness.
 * Provides a default trigger payload that can be overridden. Returns both the
 * trigger result and a mock logger for asserting logging behavior.
 *
 * @param triggerDef The trigger definition to test (only `perform` is used).
 * @param context Optional partial context overrides.
 * @param payload Optional partial trigger payload overrides (merged with defaults).
 * @param params Optional input parameter values for the trigger.
 * @returns An object with `result` (the trigger's return value) and `loggerMock`.
 * @see {@link https://prismatic.io/docs/custom-connectors/unit-testing/ | Unit Testing}
 * @example
 * import { testing } from "@prismatic-io/spectral";
 * import { webhookTrigger } from "./triggers";
 *
 * it("should process the webhook payload", async () => {
 *   const { result } = await testing.invokeTrigger(
 *     webhookTrigger,
 *     undefined, // use default context
 *     {
 *       body: { data: JSON.stringify({ event: "created" }) },
 *       headers: { "x-webhook-secret": "test-secret" },
 *     },
 *     { secret: "test-secret" },
 *   );
 *
 *   expect(result.payload).toBeDefined();
 * });
 */
export const invokeTrigger = async <
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TAllowsBranching extends boolean,
  TResult extends InvokeTriggerResult<TAllowsBranching, TriggerPayload>,
>(
  { perform }: TriggerDefinition<TInputs, TConfigVars, TAllowsBranching, TResult>,
  context?: Partial<ActionContext<TConfigVars>>,
  payload?: TriggerPayload,
  params?: ActionInputParameters<TInputs>,
): Promise<InvokeReturn<TResult>> => {
  const realizedContext = createActionContext(context);
  const realizedPayload = { ...defaultTriggerPayload(), ...payload };
  const realizedParams = params || ({} as ActionInputParameters<TInputs>);

  const result = await perform(realizedContext, realizedPayload, realizedParams);

  return {
    result,
    loggerMock: realizedContext.logger,
  };
};

/**
 * Invokes a custom component data source's `perform` function within a test harness.
 * Returns the data source result directly.
 *
 * @param dataSourceDef The data source definition to test (only `perform` is used).
 * @param params Input parameter values to pass to the data source's `perform` function.
 * @param context Optional partial context overrides.
 * @returns The data source result (e.g. a picklist, JSON form, or other data source type).
 * @see {@link https://prismatic.io/docs/custom-connectors/unit-testing/ | Unit Testing}
 * @example
 * import { testing } from "@prismatic-io/spectral";
 * import { selectChannel } from "./dataSources";
 *
 * it("should return a list of channels", async () => {
 *   const result = await testing.invokeDataSource(selectChannel, {
 *     connection: testConnection,
 *   });
 *
 *   expect(result.result).toContainEqual(
 *     expect.objectContaining({ label: "General" }),
 *   );
 * });
 */
export const invokeDataSource = async <
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TDataSourceType extends DataSourceType,
>(
  { perform }: DataSourceDefinition<TInputs, TConfigVars, TDataSourceType>,
  params: ActionInputParameters<TInputs>,
  context?: Partial<DataSourceContext<TConfigVars>>,
): Promise<InvokeDataSourceResult<TDataSourceType>> => {
  const realizedContext = createDataSourceContext(context);
  const result = await perform(realizedContext, params);

  return result;
};

type TestConnectionValue = Pick<ConnectionValue, "fields" | "context" | "token" | "key">;

type TestConfigVarValues = Record<string, string | TestConnectionValue>;

type ToTestValues<TConfigVars extends ConfigVarResultCollection> = {
  [K in keyof TConfigVars]: TConfigVars[K] extends ConnectionDefinition
    ? TestConnectionValue
    : string;
};
const createConfigVars = <TConfigVarValues extends TestConfigVarValues>(
  values?: TConfigVarValues,
): ConfigVarResultCollection => {
  return Object.entries(values ?? {}).reduce((result, [key, value]) => {
    // Connection
    if (typeof value === "object" && "fields" in value) {
      return {
        ...result,
        [key]: {
          ...value,
          configVarKey: "",
        },
      };
    }

    return {
      ...result,
      [key]: value,
    };
  }, {});
};

/**
 * Invokes a code-native integration flow within a test harness. Runs the
 * flow's `onTrigger` (if defined) followed by `onExecution`, and returns
 * the execution result. Accepts optional config variables, context overrides,
 * and a custom trigger payload.
 *
 * @param flow The flow definition to test.
 * @param options Optional config variables, context overrides, and trigger payload.
 * @returns An object with `result` (the flow execution return value) and `loggerMock`.
 * @see {@link https://prismatic.io/docs/custom-connectors/unit-testing/ | Unit Testing}
 * @example
 * import { invokeFlow } from "@prismatic-io/spectral/dist/testing";
 * import { myFlow } from "./flows";
 *
 * it("should execute the flow end-to-end", async () => {
 *   const { result } = await invokeFlow(myFlow, {
 *     configVars: {
 *       "Acme API Endpoint": "https://api.acme.com",
 *       "Acme Connection": {
 *         fields: { apiKey: "test-key" },
 *         key: "apiKey",
 *       },
 *     },
 *     payload: {
 *       body: { data: JSON.stringify({ event: "created" }) },
 *     },
 *   });
 *
 *   expect(result.data).toBeDefined();
 * });
 */
export const invokeFlow = async <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TConfigVarValues extends TestConfigVarValues = ToTestValues<TConfigVars>,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends InvokeTriggerResult<TAllowsBranching, TPayload> = InvokeTriggerResult<
    TAllowsBranching,
    TPayload
  >,
>(
  flow: Flow<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>,
  {
    configVars,
    context,
    payload,
  }: {
    configVars?: TConfigVarValues;
    context?: Partial<ActionContext<TConfigVars>>;
    payload?: Partial<TriggerPayload>;
  } = {},
): Promise<InvokeReturn<InvokeActionPerformReturn<false, unknown>>> => {
  const realizedConfigVars = createConfigVars(configVars);
  const realizedContext = createActionContext({
    ...context,
    configVars: realizedConfigVars,
  });
  const realizedPayload = { ...defaultTriggerPayload(), ...payload } as TPayload;

  const params: Record<"onTrigger", { results: any }> = {
    onTrigger: { results: realizedPayload },
  };

  if ("onTrigger" in flow && typeof flow.onTrigger === "function") {
    const triggerResult = await flow.onTrigger(
      realizedContext as any,
      realizedPayload,
      params as ActionInputParameters<TInputs>,
    );

    params.onTrigger = { results: triggerResult?.payload };
  }

  const result = await flow.onExecution(realizedContext, params);

  return {
    result,
    loggerMock: realizedContext.logger,
  };
};

export class ComponentTestHarness<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends InvokeTriggerResult<TAllowsBranching, TPayload> = InvokeTriggerResult<
    TAllowsBranching,
    TPayload
  >,
  TComponent extends Component<
    TInputs,
    TActionInputs,
    TConfigVars,
    TPayload,
    TAllowsBranching,
    TResult
  > = Component<TInputs, TActionInputs, TConfigVars, TPayload, TAllowsBranching, TResult>,
> {
  component: TComponent;

  constructor(component: TComponent) {
    this.component = component;
  }

  private buildParams(
    inputs: Input[],
    params?: Record<string, unknown>,
  ): ActionInputParameters<TInputs> {
    const defaults = inputs.reduce<Record<string, string>>(
      (result, { key, default: defaultValue }) => ({
        ...result,
        [key]: `${defaultValue ?? ""}`,
      }),
      {},
    );
    return { ...defaults, ...params } as ActionInputParameters<TInputs>;
  }

  /**
   * Source a test connection from an environment variable for local testing. See
   * https://prismatic.io/docs/custom-connectors/unit-testing/#access-connections-for-local-testing
   */
  public connectionValue({ key }: ConnectionDefinition): ConnectionValue {
    const { PRISMATIC_CONNECTION_VALUE: value } = process.env;
    if (!value) {
      throw new Error("Unable to find connection value.");
    }
    const result: ConnectionValue = {
      ...JSON.parse(value),
      key,
    };
    return result;
  }

  /**
   * Invoke a trigger by its key within a unit test. See
   * https://prismatic.io/docs/custom-connectors/unit-testing/
   */
  public async trigger(
    key: string,
    payload?: Partial<TPayload>,
    params?: Record<string, unknown>,
    context?: Partial<ActionContext<TConfigVars>>,
  ): Promise<TriggerResult> {
    const trigger = this.component.triggers[key];

    return trigger.perform(
      // @ts-expect-error -- Revisit if this should support polling
      createActionContext(context),
      { ...defaultTriggerPayload(), ...payload } as TPayload,
      this.buildParams(trigger.inputs, params),
    );
  }

  /**
   * Invoke a trigger's onInstanceDeploy function by its key within a unit test. See
   * https://prismatic.io/docs/custom-connectors/unit-testing/
   */
  public async triggerOnInstanceDeploy<TConfigVars extends ConfigVarResultCollection>(
    key: string,
    params?: Record<string, unknown>,
    context?: Partial<ActionContext<TConfigVars>>,
  ): Promise<TriggerEventFunctionReturn | void> {
    const trigger = this.component.triggers[key];
    if (!trigger.onInstanceDeploy) {
      throw new Error("Trigger does not support onInstanceDeploy");
    }
    return trigger.onInstanceDeploy(
      createActionContext(context),
      this.buildParams(trigger.inputs, params),
    );
  }

  /**
   * Invoke a trigger's onInstanceDelete function by its key within a unit test. See
   * https://prismatic.io/docs/custom-connectors/unit-testing/
   */
  public async triggerOnInstanceDelete<TConfigVars extends ConfigVarResultCollection>(
    key: string,
    params?: Record<string, unknown>,
    context?: Partial<ActionContext<TConfigVars>>,
  ): Promise<TriggerEventFunctionReturn | void> {
    const trigger = this.component.triggers[key];
    if (!trigger.onInstanceDelete) {
      throw new Error("Trigger does not support onInstanceDelete");
    }
    return trigger.onInstanceDelete(
      createActionContext(context),
      this.buildParams(trigger.inputs, params),
    );
  }

  /**
   * Invoke an action by its key within a unit test. See
   * https://prismatic.io/docs/custom-connectors/unit-testing/
   */
  public async action<TConfigVars extends ConfigVarResultCollection>(
    key: string,
    params?: Record<string, unknown>,
    context?: Partial<ActionContext<TConfigVars>>,
  ): Promise<ServerActionPerformReturn> {
    const action = this.component.actions[key];
    return action.perform(createActionContext(context), this.buildParams(action.inputs, params));
  }

  /**
   * Invoke a data source by its key within a unit test. See
   * https://prismatic.io/docs/custom-connectors/unit-testing/
   */
  public async dataSource<TConfigVars extends ConfigVarResultCollection>(
    key: string,
    params?: Record<string, unknown>,
    context?: Partial<DataSourceContext<TConfigVars>>,
  ): Promise<DataSourceResult> {
    const dataSource = this.component.dataSources[key];
    return dataSource.perform(
      createDataSourceContext(context),
      this.buildParams(dataSource.inputs, params),
    );
  }
}

/**
 * Create a testing harness to test a custom component's actions, triggers
 * and data sources by key. The harness automatically provides default input
 * values and mock context.
 *
 * @param component The compiled component object (the result of calling `component()`).
 * @returns A `ComponentTestHarness` instance with `.action()`, `.trigger()`, and `.dataSource()` methods.
 * @see {@link https://prismatic.io/docs/custom-connectors/unit-testing/ | Unit Testing}
 * @example
 * import { testing } from "@prismatic-io/spectral";
 * import myComponent from ".";
 *
 * const harness = testing.createHarness(myComponent);
 *
 * it("should list items", async () => {
 *   const result = await harness.action("listItems", {
 *     connection: testConnection,
 *     limit: "10",
 *   });
 *   expect(result.data).toHaveProperty("items");
 * });
 *
 * it("should handle a webhook trigger", async () => {
 *   const result = await harness.trigger("webhook", {
 *     body: { data: '{"event":"created"}' },
 *   });
 *   expect(result.payload).toBeDefined();
 * });
 */
export const createHarness = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends InvokeTriggerResult<TAllowsBranching, TPayload> = InvokeTriggerResult<
    TAllowsBranching,
    TPayload
  >,
  TComponent extends Component<
    TInputs,
    TActionInputs,
    TConfigVars,
    TPayload,
    TAllowsBranching,
    TResult
  > = Component<TInputs, TActionInputs, TConfigVars, TPayload, TAllowsBranching, TResult>,
>(
  component: TComponent,
): ComponentTestHarness<
  TInputs,
  TActionInputs,
  TConfigVars,
  TPayload,
  TAllowsBranching,
  TResult,
  TComponent
> => {
  return new ComponentTestHarness(component);
};

export default {
  loggerMock,
  invoke,
  invokeTrigger,
  createHarness,
  invokeDataSource,
};
