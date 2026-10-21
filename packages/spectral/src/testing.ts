/**
 * This module provides functions to help developers unit
 * test custom components prior to publishing them. For
 * information on unit testing, check out our docs:
 * https://prismatic.io/docs/custom-connectors/unit-testing/
 */

import type { AxiosRequestConfig, AxiosResponse } from "axios";
import cloneDeep from "lodash/cloneDeep";
import { localMock } from "./localMock";
import { CallableMocks, type FunctionMock } from "./testingMocks";

export type { FunctionMock } from "./testingMocks";

import type {
  ActionLogger,
  Component,
  ConnectionValue,
  DataSourceContext,
  DataSourceResult,
  Input,
  ActionPerformReturn as ServerActionPerformReturn,
  TriggerResult,
} from "./serverTypes";
import {
  invokeWithContext,
  runWithCallableMocks,
  runWithDataSourceContext,
} from "./serverTypes/asyncContext";
import { getBoundTrigger, normalizeBoundTrigger } from "./serverTypes/boundTrigger";
import { createPollingState } from "./serverTypes/pollingState";
import type {
  ActionContext,
  ActionDefinition,
  ActionInputParameters,
  CodeNativeActionLogger,
  ComponentManifest,
  ConfiguredConnections,
  ConfiguredUserValue,
  ConfiguredValue,
  ConfigVarResultCollection,
  ConnectionDefinition,
  DataSourceDefinition,
  DataSourceType,
  Flow,
  Inputs,
  IntegrationDefinitionConfiguration,
  ActionPerformReturn as InvokeActionPerformReturn,
  DataSourceResult as InvokeDataSourceResult,
  TriggerResult as InvokeTriggerResult,
  PollingContext,
  TriggerDefinition,
  TriggerEventFunctionReturn,
  TriggerPayload,
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
 * Creates an isolated mock ActionLogger with assertion-compatible spies.
 * Use each method's mockClear/mockReset for cleanup; runner-wide cleanup is not
 * supported. Log methods do not modify or forward to the global console.
 *
 * @returns A mock `ActionLogger` with assertion-compatible spy methods.
 * @see {@link https://prismatic.io/docs/custom-connectors/unit-testing/#verifying-correct-logging-in-action-tests | Verifying Logging}
 * @example
 * import { testing } from "@prismatic-io/spectral";
 *
 * const logger = testing.loggerMock();
 * // Pass logger in context, then assert:
 * expect(logger.info).toHaveBeenCalledWith("Processing started");
 */
export const loggerMock = (): CodeNativeActionLogger => ({
  metric: localMock(),
  trace: localMock(),
  debug: localMock(),
  info: localMock(),
  log: localMock(),
  warn: localMock(),
  error: localMock(),
  section: localMock(),
  sectionEnd: localMock(),
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
 * import { createMockContextComponents } from "@prismatic-io/spectral/testing";
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

/**
 * The context a code-native flow handler receives: an `ActionContext` whose logger carries
 * the section methods that only code-native integrations get.
 */
type CodeNativeTestContext<TConfigVars extends ConfigVarResultCollection> = ActionContext<
  TConfigVars,
  Record<string, ComponentManifest["actions"]>,
  string[],
  CodeNativeActionLogger
>;

const createCodeNativeActionContext = <TConfigVars extends ConfigVarResultCollection>(
  context?: Partial<CodeNativeTestContext<TConfigVars>>,
): CodeNativeTestContext<TConfigVars> => {
  const actionContext = createActionContext<TConfigVars>(context);

  return {
    ...actionContext,
    logger: context?.logger ?? loggerMock(),
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
 *
 * `TLogger` widens to `CodeNativeActionLogger` for `invokeFlow`, whose context
 * carries the section methods that only code-native integrations get.
 */
interface InvokeReturn<ReturnData, TLogger extends ActionLogger = ActionLogger> {
  result: ReturnData;
  loggerMock: TLogger;
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
  TOnDeployInputs extends Inputs = Inputs,
>(
  { perform }: TriggerDefinition<TInputs, TConfigVars, TAllowsBranching, TResult, TOnDeployInputs>,
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

/** A flow's connections by scope, as test values. */
type TestScopedConnections = {
  [TScope in keyof ConfiguredConnections]?: {
    [TName in keyof ConfiguredConnections[TScope]]?: TestConnectionValue;
  };
};

/**
 * The configuration a flow of an integration with a `configuration` reads. Present once
 * the integration declares its configuration types by augmenting
 * `IntegrationDefinitionConfiguration`.
 */
export interface InvokeFlowConfiguration {
  /** The fields of the instance configuration value that the flow reads. */
  configuration?: Partial<ConfiguredValue>;
  /** The fields of the user-level configuration value that the flow reads. */
  userConfiguration?: Partial<ConfiguredUserValue>;
  /** The flow's connections by scope. */
  connections?: TestScopedConnections;
  /** A flow of an integration with a `configuration` reads no config vars. */
  configVars?: never;
}

/** The options of {@link invokeFlow}. */
export type InvokeFlowOptions<
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TConfigVarValues extends TestConfigVarValues = ToTestValues<TConfigVars>,
> = {
  /** Overrides of the flow's context. */
  context?: Partial<CodeNativeTestContext<TConfigVars>>;
  /** The trigger payload, merged over a default one. */
  payload?: Partial<TriggerPayload>;
} & (keyof IntegrationDefinitionConfiguration extends never
  ? { configVars?: TConfigVarValues }
  : InvokeFlowConfiguration);

/**
 * The connections a flow reads off `context.connections`. Each gets the `configVarKey`
 * the runner gives it, `<scope>.<name>`.
 */
const createScopedConnections = (
  connections: Record<string, Record<string, TestConnectionValue | undefined> | undefined>,
): Record<string, Record<string, ConnectionValue>> =>
  Object.fromEntries(
    Object.entries(connections).map(([scope, named]) => [
      scope,
      Object.fromEntries(
        Object.entries(named ?? {}).flatMap(([name, value]) =>
          value ? [[name, { ...value, configVarKey: `${scope}.${name}` }]] : [],
        ),
      ),
    ]),
  );

/**
 * Invokes a code-native integration flow within a test harness. Runs the
 * flow's `onTrigger` (if defined) followed by `onExecution`, and returns
 * the execution result. Accepts optional config variables, context overrides,
 * and a custom trigger payload.
 * Both callbacks bind the test context so generated manifest helpers use the
 * component mocks supplied through `options.context.components`.
 *
 * A flow of an integration with a `configuration` reads its values and
 * connections from the context, not from config variables. Once the
 * integration augments `IntegrationDefinitionConfiguration`, pass them as
 * `configuration`, `userConfiguration`, and `connections` in place of
 * `configVars`.
 *
 * @param flow The flow definition to test.
 * @param options Optional config variables or configuration, context overrides, and trigger payload.
 * @returns An object with `result` (the flow execution return value) and `loggerMock`.
 * @see {@link https://prismatic.io/docs/custom-connectors/unit-testing/ | Unit Testing}
 * @example
 * import { invokeFlow } from "@prismatic-io/spectral/testing";
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
 *
 * @example
 * // A flow of an integration with a configuration
 * it("should sync the configured region", async () => {
 *   const { result } = await invokeFlow(syncFlow, {
 *     configuration: { region: "us-east-1" },
 *     connections: {
 *       instance: { acme: { key: "apiKey", fields: { apiKey: "test-key" } } },
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
  // `any` for TItem/TPaginationState/TTriggerPayload: the tester accepts a flow with any
  // resolver item and cursor typing; it drives the flow dynamically and does not rely on
  // the precise `onExecution` param type.
  flow: Flow<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult, any, any, any>,
  options: InvokeFlowOptions<TConfigVars, TConfigVarValues> = {},
): Promise<InvokeReturn<InvokeActionPerformReturn<false, unknown>, CodeNativeActionLogger>> => {
  // Either branch of the flag: this module is compiled without it.
  const { configVars, configuration, userConfiguration, connections, context, payload } =
    options as InvokeFlowOptions<TConfigVars, TConfigVarValues> & {
      configVars?: TConfigVarValues;
    } & Omit<InvokeFlowConfiguration, "configVars">;
  const realizedConfigVars = createConfigVars(configVars);
  const realizedContext = createCodeNativeActionContext({
    ...(configuration !== undefined ? { configuration } : {}),
    ...(userConfiguration !== undefined ? { userConfiguration } : {}),
    ...(connections ? { connections: createScopedConnections(connections) } : {}),
    ...context,
    configVars: realizedConfigVars,
  });
  const realizedPayload = { ...defaultTriggerPayload(), ...payload } as TPayload;

  const params: Record<"onTrigger", { results: any }> = {
    onTrigger: { results: realizedPayload },
  };

  if ("onTrigger" in flow && typeof flow.onTrigger === "function") {
    const triggerResult = await invokeWithContext(
      // A polling trigger's perform additionally expects the `polling` helpers, which this
      // tester does not simulate; the cast is narrowed to just that gap.
      realizedContext as typeof realizedContext & PollingContext<TActionInputs>,
      flow.onTrigger.bind(flow),
      realizedPayload,
      params as ActionInputParameters<TInputs>,
    );

    params.onTrigger = { results: triggerResult?.payload };
  }

  // Bind the test context itself so manifest helpers use the supplied component mocks.
  const result = await invokeWithContext(realizedContext, flow.onExecution.bind(flow), params);

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
export function createHarness<TFlow extends HarnessFlow>(flow: TFlow): FlowTestHarness<TFlow>;
export function createHarness<
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
>;
export function createHarness(
  subject: HarnessFlow | Component<any, any, any, any, any, any>,
): FlowTestHarness<HarnessFlow> | ComponentTestHarness<any, any, any, any, any, any> {
  if ("onExecution" in subject && typeof subject.onExecution === "function") {
    return new FlowTestHarness(subject as HarnessFlow);
  }
  return new ComponentTestHarness(subject as Component<any, any, any, any, any, any>);
}

/** Flow inputs are erased here; each flow retains its own onExecution return type. */
type HarnessFlow = Flow<any, any, any, any, any, any, any, any>;
type HarnessFunction = (...args: any[]) => any;

const flowTestContext = (options: InvokeFlowOptions) => {
  const { configVars, configuration, userConfiguration, connections, context } =
    options as InvokeFlowOptions & { configVars?: TestConfigVarValues } & Omit<
        InvokeFlowConfiguration,
        "configVars"
      >;
  return createCodeNativeActionContext({
    ...(configuration !== undefined ? { configuration } : {}),
    ...(userConfiguration !== undefined ? { userConfiguration } : {}),
    ...(connections ? { connections: createScopedConnections(connections) } : {}),
    ...context,
    configVars: createConfigVars(configVars),
  });
};

export type FlowHarnessRunOptions = InvokeFlowOptions & {
  /** Maximum discovery pages per run; defaults to 100. */
  maxPages?: number;
  /** Local batch workers; defaults to 1 and is capped by concurrentBatchLimit. */
  concurrency?: number;
};

/** Narrow status before reading the single-execution result. Batch results retain dispatch order. */
export type FlowHarnessRunResult<T> = {
  loggerMock: CodeNativeActionLogger;
  pages: number;
  results: T[];
} & (
  | { status: "completed"; result: T }
  | { status: "batched"; result: undefined }
  | { status: "skipped"; reason: "polledNoChanges"; result: undefined }
);

/** Runs CNI logic with automatic, invocation-scoped mocks of local callable dependencies. */
export class FlowTestHarness<TFlow extends HarnessFlow> {
  private readonly mocks = new CallableMocks();

  /** In-memory instance state shared by runs; explicit context.instanceState takes precedence. */
  readonly instanceState: Record<string, unknown> = {};

  constructor(readonly flow: TFlow) {}

  /** Returns the same typed mock before or after execution. No registration is necessary. */
  mock<T extends HarnessFunction>(callable: T): FunctionMock<T> {
    return this.mocks.mock(callable);
  }

  private async scoped<T>(callback: () => T): Promise<Awaited<T>> {
    await this.mocks.initialize();

    return await runWithCallableMocks(this.mocks.dispatch, callback);
  }

  /** Runs one poll or webhook, including pagination and batch dispatch when configured. */
  run(options: FlowHarnessRunOptions = {}) {
    return this.execute(options, false);
  }

  /** Explicitly runs initial-sync discovery and execution, independently of deploy lifecycle. */
  initialSync(options: FlowHarnessRunOptions = {}) {
    return this.execute(options, true);
  }

  private execute(
    options: FlowHarnessRunOptions,
    initialSync: boolean,
  ): Promise<FlowHarnessRunResult<Awaited<ReturnType<TFlow["onExecution"]>>>> {
    return this.scoped(async () => {
      type Result = Awaited<ReturnType<TFlow["onExecution"]>>;
      const flow = normalizeBoundTrigger(this.flow);
      const bound = getBoundTrigger(flow.onTrigger);
      const batch = flow.batchConfig;
      const positiveInteger = (value: number, name: string) => {
        if (!Number.isSafeInteger(value) || value < 1) {
          throw new Error(`${name} must be a positive safe integer.`);
        }

        return value;
      };

      const maxPages = positiveInteger(options.maxPages ?? 100, "maxPages");
      let concurrency = positiveInteger(options.concurrency ?? 1, "concurrency");
      if (batch) {
        positiveInteger(batch.batchSize, "batchSize");
        if (batch.concurrentBatchLimit !== undefined) {
          concurrency = Math.min(
            concurrency,
            positiveInteger(batch.concurrentBatchLimit, "concurrentBatchLimit"),
          );
        }
      }

      const contextOptions = {
        ...options,
        context: {
          instanceState: this.instanceState,
          ...options.context,
          batch: batch
            ? { enabled: true as const, batchSize: batch.batchSize }
            : { enabled: false as const },
        },
      };

      const context = flowTestContext(contextOptions);
      const discoveryContext = { ...context, polling: createPollingState(context) };
      let payload: TriggerPayload = { ...defaultTriggerPayload(), ...cloneDeep(options.payload) };
      const results: Result[] = [];
      let pages = 0;
      const report = () => ({ loggerMock: context.logger, pages, results });
      const resolverKey = initialSync ? "onDeployResolver" : "triggerResolver";

      // Bound metadata must supply callable adapters. Never execute original component resolvers.
      const resolver = bound ? bound[resolverKey] : (flow as any)[resolverKey];
      const localBatchTrigger = "trigger" in flow ? flow.trigger : undefined;
      const fire = initialSync
        ? (localBatchTrigger?.onDeploy ?? flow.onDeployTrigger)
        : (localBatchTrigger?.onTrigger ?? flow.onTrigger);
      if (initialSync && typeof fire !== "function") {
        throw new Error("This flow has no initial-sync trigger.");
      }

      if (fire !== undefined && typeof fire !== "function") {
        throw new Error(
          "The flow harness requires a local trigger, not a platform trigger reference.",
        );
      }

      if (batch && typeof fire !== "function") {
        throw new Error("Batch discovery requires a trigger.");
      }

      if (batch && bound && !resolver) {
        throw new Error(
          `Bound callable ${resolverKey} is unavailable. Rebuild the component with this SDK; original component callbacks will not be executed.`,
        );
      }

      const executePayload = async (executionPayload: TriggerPayload) => {
        const executionContext = flowTestContext({
          ...contextOptions,
          context: { ...contextOptions.context, logger: context.logger, executionState: {} },
        });

        return (await invokeWithContext(executionContext, flow.onExecution.bind(flow), {
          onTrigger: { results: executionPayload },
        })) as Result;
      };

      while (true) {
        if (pages >= maxPages) {
          throw new Error(
            `Batch discovery exceeded maxPages (${maxPages}). Check pagination mocks or increase maxPages.`,
          );
        }
        pages++;
        const returned =
          typeof fire === "function"
            ? ((await invokeWithContext(
                discoveryContext,
                fire.bind(flow) as any,
                payload,
                {},
              )) as any)
            : { payload };
        if (pages === 1 && returned?.polledNoChanges === true) {
          return { ...report(), status: "skipped", reason: "polledNoChanges", result: undefined };
        }

        if (!batch) {
          const result = (await invokeWithContext(context, flow.onExecution.bind(flow), {
            onTrigger: { results: returned?.payload },
          })) as Result;
          results.push(result);

          return { ...report(), status: "completed", result };
        }

        if (!returned || (!localBatchTrigger && !returned.payload)) {
          throw new Error(
            `Batch ${initialSync ? "onDeployPerform" : "perform"} returned no payload. Configure its callable mock.`,
          );
        }

        const items = localBatchTrigger
          ? returned.items
          : resolver?.resolveItems
            ? await invokeWithContext(discoveryContext, resolver.resolveItems, returned)
            : undefined;
        if (!Array.isArray(items)) {
          throw new Error(
            `Batch ${resolverKey}.resolveItems must return an array. Configure its callable mock when using a component trigger.`,
          );
        }

        const next = localBatchTrigger
          ? (returned.paginationState ?? null)
          : resolver?.getNextPaginationState
            ? await invokeWithContext(discoveryContext, resolver.getNextPaginationState, returned)
            : null;
        if (next !== null && (typeof next !== "object" || Array.isArray(next))) {
          throw new Error(
            `Batch ${resolverKey}.getNextPaginationState must return an object or null. Configure its callable mock.`,
          );
        }

        const pagePayload = localBatchTrigger ? payload : returned.payload;
        const batches: TriggerPayload[] = [];
        for (let index = 0; index < items.length; index += batch.batchSize) {
          batches.push({
            ...cloneDeep(pagePayload),
            body: {
              ...cloneDeep(pagePayload.body),
              data: cloneDeep(
                batch.batchSize === 1 ? items[index] : items.slice(index, index + batch.batchSize),
              ),
            },
          });
        }

        let index = 0;
        let failed = false;
        const pageResults: Result[] = new Array(batches.length);
        const workers = Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
          while (!failed && index < batches.length) {
            const current = index++;
            try {
              pageResults[current] = await executePayload(batches[current]);
            } catch (error) {
              failed = true;
              throw error;
            }
          }
        });

        // Drain in-flight work before leaving the mock scope, including on failure.
        const settled = await Promise.allSettled(workers);
        const failure = settled.find((entry) => entry.status === "rejected");
        if (failure?.status === "rejected") throw failure.reason;
        results.push(...pageResults);
        if (next === null) return { ...report(), status: "batched", result: undefined };
        payload = { ...payload, paginationState: cloneDeep(next) };
      }
    });
  }

  /** Exercises an application helper or individual callback in a CNI execution context. */
  invoke<T>(
    callback: (context: ReturnType<typeof flowTestContext>) => T,
    options: InvokeFlowOptions = {},
  ): Promise<Awaited<T>> {
    const context = flowTestContext({
      ...options,
      context: { instanceState: this.instanceState, ...options.context },
    });

    return this.scoped(() => invokeWithContext(context, callback));
  }

  /** Exercises a configuration callback with the smaller data-source context. */
  configuration<T>(
    callback: (context: DataSourceContext) => T,
    context?: Partial<DataSourceContext>,
  ): Promise<Awaited<T>> {
    const realized = createDataSourceContext(context);

    return this.scoped(() => runWithDataSourceContext(realized, () => callback(realized)));
  }

  onInstanceDeploy(options: InvokeFlowOptions = {}) {
    return this.invoke(
      (context) => normalizeBoundTrigger(this.flow).onInstanceDeploy?.(context, {}),
      options,
    );
  }

  onInstanceDelete(options: InvokeFlowOptions = {}) {
    return this.invoke(
      (context) => normalizeBoundTrigger(this.flow).onInstanceDelete?.(context, {}),
      options,
    );
  }
}

export default {
  loggerMock,
  invoke,
  invokeTrigger,
  createHarness,
  invokeDataSource,
};
