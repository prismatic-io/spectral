/**
 * This module provides functions to help developers unit
 * test custom components prior to publishing them. For
 * information on unit testing, check out our docs:
 * https://prismatic.io/docs/custom-components/writing-custom-components/#testing-a-component
 */

import {
  TriggerPayload,
  TriggerResult,
  ConnectionValue,
  ActionLogger,
  ActionLoggerFunction,
  Component,
  ActionContext,
  ActionPerformReturn,
  DataSourceResult,
  Input,
  DataSourceContext,
} from "./serverTypes";
import {
  ConnectionDefinition,
  ActionDefinition,
  TriggerDefinition,
  Inputs,
  ActionInputParameters,
  DataSourceDefinition,
  ActionPerformReturn as InvokeActionPerformReturn,
  TriggerResult as InvokeTriggerResult,
  DataSourceType,
  DataSourceResult as InvokeDataSourceResult,
  TriggerEventFunctionReturn,
  Flow,
  ConfigVarResultCollection,
  ConfigPages,
  ExtractConfigVars,
  ComponentSelector,
} from "./types";
import { spyOn } from "jest-mock";

export const createConnection = <T extends ConnectionDefinition>(
  { key }: T,
  values: Record<string, unknown>,
  tokenValues?: Record<string, unknown>
): ConnectionValue => ({
  configVarKey: "",
  key,
  fields: values,
  token: tokenValues,
});

export const defaultConnectionValueEnvironmentVariable =
  "PRISMATIC_CONNECTION_VALUE";

export const connectionValue = (
  envVarKey = defaultConnectionValueEnvironmentVariable
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
 * Pre-built mock of ActionLogger. Suitable for asserting logs are created as expected.
 * See https://prismatic.io/docs/custom-components/writing-custom-components/#verifying-correct-logging-in-action-tests for information on testing correct logging behavior in your custom component.
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

const createActionContext = <TConfigVars extends ConfigVarResultCollection>(
  context?: Partial<ActionContext<TConfigVars>>
): ActionContext<TConfigVars> => {
  return {
    logger: loggerMock(),
    instanceState: {},
    crossFlowState: {},
    executionState: {},
    integrationState: {},
    configVars: {} as unknown as TConfigVars,
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
    },
    startedAt: new Date().toISOString(),
    ...context,
  };
};

const createDataSourceContext = <TConfigVars extends ConfigVarResultCollection>(
  context?: Partial<DataSourceContext<TConfigVars>>
): DataSourceContext<TConfigVars> => {
  return {
    logger: loggerMock(),
    configVars: {} as unknown as TConfigVars,
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
 * Invokes specified ActionDefinition perform function using supplied params
 * and optional context. Accepts a generic type matching ActionPerformReturn as a convenience
 * to avoid extra casting within test methods. Returns an InvokeResult containing both the
 * action result and a mock logger for asserting logging.
 */
export const invoke = async <
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TAllowsBranching extends boolean,
  TReturn extends InvokeActionPerformReturn<TAllowsBranching, unknown>
>(
  {
    perform,
  }: ActionDefinition<TInputs, TConfigVars, TAllowsBranching, TReturn>,
  params: ActionInputParameters<TInputs>,
  context?: Partial<ActionContext<TConfigVars>>
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
    },
    startedAt: new Date().toISOString(),
  };
};

/**
 * Invokes specified TriggerDefinition perform function using supplied params
 * and optional context. Accepts a generic type matching TriggerResult as a convenience
 * to avoid extra casting within test methods. Returns an InvokeResult containing both the
 * trigger result and a mock logger for asserting logging.
 */
export const invokeTrigger = async <
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TAllowsBranching extends boolean,
  TResult extends InvokeTriggerResult<TAllowsBranching, TriggerPayload>
>(
  {
    perform,
  }: TriggerDefinition<TInputs, TConfigVars, TAllowsBranching, TResult>,
  context?: Partial<ActionContext<TConfigVars>>,
  payload?: TriggerPayload,
  params?: ActionInputParameters<TInputs>
): Promise<InvokeReturn<TResult>> => {
  const realizedContext = createActionContext(context);
  const realizedPayload = { ...defaultTriggerPayload(), ...payload };
  const realizedParams = params || ({} as ActionInputParameters<TInputs>);

  const result = await perform(
    realizedContext,
    realizedPayload,
    realizedParams
  );

  return {
    result,
    loggerMock: realizedContext.logger,
  };
};

/**
 * Invokes specified DataSourceDefinition perform function using supplied params.
 * Accepts a generic type matching DataSourceResult as a convenience to avoid extra
 * casting within test methods. Returns a DataSourceResult.
 */
export const invokeDataSource = async <
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TDataSourceType extends DataSourceType
>(
  { perform }: DataSourceDefinition<TInputs, TConfigVars, TDataSourceType>,
  params: ActionInputParameters<TInputs>,
  context?: Partial<DataSourceContext<TConfigVars>>
): Promise<InvokeDataSourceResult<TDataSourceType>> => {
  const realizedContext = createDataSourceContext(context);
  const result = await perform(realizedContext, params);

  return result;
};

type TestConnectionValue = Pick<
  ConnectionValue,
  "fields" | "context" | "token"
>;

type TestConfigVarValues = Record<string, string | TestConnectionValue>;

type ToTestValues<TConfigVars extends ConfigVarResultCollection> = {
  [K in keyof TConfigVars]: TConfigVars[K] extends ConnectionDefinition
    ? TestConnectionValue
    : string;
};
const createConfigVars = <TConfigVarValues extends TestConfigVarValues>(
  values?: TConfigVarValues
): ConfigVarResultCollection => {
  return Object.entries(values ?? {}).reduce((result, [key, value]) => {
    // Connection
    if (typeof value === "object" && "fields" in value) {
      return {
        ...result,
        [key]: {
          ...value,
          key,
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
 * Invokes specified Flow of a Code Native Integration using supplied params.
 * Runs the Trigger and then the Action function and returns the result of the Action.
 */
export const invokeFlow = async <
  TConfigPages extends ConfigPages<any>,
  TConfigVars extends ConfigVarResultCollection = ExtractConfigVars<TConfigPages>,
  TConfigVarValues extends TestConfigVarValues = ToTestValues<TConfigVars>
>(
  flow: Flow<TConfigPages, ComponentSelector<any>>,
  {
    configVars,
    context,
    payload,
  }: {
    configVars?: TConfigVarValues;
    context?: Partial<ActionContext<TConfigVars>>;
    payload?: Partial<TriggerPayload>;
  } = {}
): Promise<InvokeReturn<InvokeActionPerformReturn<false, unknown>>> => {
  const realizedConfigVars = createConfigVars(configVars);
  const realizedContext = createActionContext({
    ...context,
    configVars: realizedConfigVars,
  });
  const realizedPayload = { ...defaultTriggerPayload(), ...payload };

  const params: Record<"onTrigger", { results: any }> = {
    onTrigger: { results: realizedPayload },
  };

  if ("onTrigger" in flow && typeof flow.onTrigger === "function") {
    const triggerResult = await flow.onTrigger(
      realizedContext as any,
      realizedPayload,
      params
    );

    params.onTrigger = { results: triggerResult?.payload };
  }

  const result = await flow.onExecution(
    realizedContext as ActionContext<any>,
    params
  );

  return {
    result,
    loggerMock: realizedContext.logger,
  };
};

export class ComponentTestHarness<TComponent extends Component> {
  component: TComponent;

  constructor(component: TComponent) {
    this.component = component;
  }

  private buildParams(
    inputs: Input[],
    params?: Record<string, unknown>
  ): Record<string, unknown> {
    const defaults = inputs.reduce<Record<string, string>>(
      (result, { key, default: defaultValue }) => ({
        ...result,
        [key]: `${defaultValue ?? ""}`,
      }),
      {}
    );
    return { ...defaults, ...params };
  }

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

  public async trigger<TConfigVars extends ConfigVarResultCollection>(
    key: string,
    payload?: TriggerPayload,
    params?: Record<string, unknown>,
    context?: Partial<ActionContext<TConfigVars>>
  ): Promise<TriggerResult> {
    const trigger = this.component.triggers[key];
    return trigger.perform(
      createActionContext(context),
      { ...defaultTriggerPayload(), ...payload },
      this.buildParams(trigger.inputs, params)
    );
  }

  public async triggerOnInstanceDeploy<
    TConfigVars extends ConfigVarResultCollection
  >(
    key: string,
    params?: Record<string, unknown>,
    context?: Partial<ActionContext<TConfigVars>>
  ): Promise<void | TriggerEventFunctionReturn> {
    const trigger = this.component.triggers[key];
    if (!trigger.onInstanceDeploy) {
      throw new Error("Trigger does not support onInstanceDeploy");
    }
    return trigger.onInstanceDeploy(
      createActionContext(context),
      this.buildParams(trigger.inputs, params)
    );
  }

  public async triggerOnInstanceDelete<
    TConfigVars extends ConfigVarResultCollection
  >(
    key: string,
    params?: Record<string, unknown>,
    context?: Partial<ActionContext<TConfigVars>>
  ): Promise<void | TriggerEventFunctionReturn> {
    const trigger = this.component.triggers[key];
    if (!trigger.onInstanceDelete) {
      throw new Error("Trigger does not support onInstanceDelete");
    }
    return trigger.onInstanceDelete(
      createActionContext(context),
      this.buildParams(trigger.inputs, params)
    );
  }

  public async action<TConfigVars extends ConfigVarResultCollection>(
    key: string,
    params?: Record<string, unknown>,
    context?: Partial<ActionContext<TConfigVars>>
  ): Promise<ActionPerformReturn> {
    const action = this.component.actions[key];
    return action.perform(
      createActionContext(context),
      this.buildParams(action.inputs, params)
    );
  }

  public async dataSource<TConfigVars extends ConfigVarResultCollection>(
    key: string,
    params?: Record<string, unknown>,
    context?: Partial<DataSourceContext<TConfigVars>>
  ): Promise<DataSourceResult> {
    const dataSource = this.component.dataSources[key];
    return dataSource.perform(
      createDataSourceContext(context),
      this.buildParams(dataSource.inputs, params)
    );
  }
}

export const createHarness = <TComponent extends Component>(
  component: TComponent
): ComponentTestHarness<TComponent> => {
  return new ComponentTestHarness(component);
};

export default {
  loggerMock,
  invoke,
  invokeTrigger,
  createHarness,
  invokeDataSource,
};
