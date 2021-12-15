/**
 * This module provides functions to help developers unit
 * test custom components prior to publishing them. For
 * information on unit testing, check out our docs:
 * https://prismatic.io/docs/custom-components/writing-custom-components/#testing-a-component
 */

/** */
import {
  ActionContext,
  ActionLogger,
  ActionLoggerFunction,
  ActionDefinition,
  ActionInputParameters,
  ConnectionDefinition,
  Connection,
  ActionPerformReturn,
  Inputs,
  TriggerDefinition,
  TriggerResult,
  TriggerPayload,
} from "./types";
import { spyOn } from "jest-mock";

export const createConnection = <T extends ConnectionDefinition>(
  { key }: T,
  values: Record<string, unknown>
): Connection => ({
  configVarKey: "",
  key,
  fields: values,
});

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

/**
 * The type of data returned by an `invoke()` function used for unit testing component actions.
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
  T extends Inputs,
  AllowsBranching extends boolean,
  ReturnData extends ActionPerformReturn<AllowsBranching, unknown>
>(
  actionBase:
    | ActionDefinition<T, AllowsBranching, ReturnData>
    | Record<string, ActionDefinition<T, AllowsBranching, ReturnData>>,
  params: ActionInputParameters<T>,
  context?: Partial<ActionContext>
): Promise<InvokeReturn<ReturnData>> => {
  const action = (
    actionBase.perform ? actionBase : Object.values(actionBase)[0]
  ) as ActionDefinition<T, AllowsBranching, ReturnData>;

  const realizedContext = {
    logger: loggerMock(),
    instanceState: {},
    executionState: {},
    stepId: "mockStepId",
    executionId: "mockExecutionId",
    ...context,
  };

  const result = await action.perform(realizedContext, params);

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
    webhookUrls: {
      "Flow 1": "https://example.com",
    },
    webhookApiKeys: {
      "Flow 1": ["example-123", "example-456"],
    },
    customer: {
      name: "Customer 1",
      externalId: "1234",
    },
  };
};

/**
 * Invokes specified TriggerDefinition perform function using supplied params
 * and optional context. Accepts a generic type matching TriggerResult as a convenience
 * to avoid extra casting within test methods. Returns an InvokeResult containing both the
 * trigger result and a mock logger for asserting logging.
 */
export const invokeTrigger = async <
  T extends Inputs,
  AllowsBranching extends boolean,
  Result extends TriggerResult<AllowsBranching>
>(
  triggerBase:
    | TriggerDefinition<T, AllowsBranching, Result>
    | Record<string, TriggerDefinition<T, AllowsBranching, Result>>,
  context?: Partial<ActionContext>,
  payload?: TriggerPayload,
  params?: ActionInputParameters<T>
): Promise<InvokeReturn<Result>> => {
  const trigger = (
    triggerBase.perform ? triggerBase : Object.values(triggerBase)[0]
  ) as TriggerDefinition<T, AllowsBranching, Result>;

  const realizedContext = {
    logger: loggerMock(),
    instanceState: {},
    executionState: {},
    stepId: "mockStepId",
    executionId: "mockExecutionId",
    ...context,
  };

  const realizedPayload = {
    ...defaultTriggerPayload(),
    ...payload,
  };

  const realizedParams = params || ({} as ActionInputParameters<T>);

  const result = await trigger.perform(
    realizedContext,
    realizedPayload,
    realizedParams
  );

  return {
    result,
    loggerMock: realizedContext.logger,
  };
};

export default {
  invoke,
  invokeTrigger,
  loggerMock,
};
