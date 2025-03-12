import axios, { AxiosRequestConfig } from "axios";
import type {
  ActionContext,
  ActionDefinition,
  ActionInputParameters,
  ConfigVarResultCollection,
  ErrorHandler,
  ExecutionFrame,
  FlowInvoker,
  Inputs,
  PollingContext,
  PollingTriggerDefinition,
  PollingTriggerPerformFunction,
  TriggerPayload,
  TriggerResult,
} from "../types";
import uniq from "lodash/uniq";
import { createDebugContext, logDebugResults } from "./context";

export type PerformFn = (...args: any[]) => Promise<any>;
export type CleanFn = (...args: any[]) => any;

export type InputCleaners = Record<string, CleanFn | undefined>;

interface CreatePerformProps {
  inputCleaners: InputCleaners;
  errorHandler?: ErrorHandler;
}

export const cleanParams = (
  params: Record<string, unknown>,
  cleaners: InputCleaners,
): Record<string, any> => {
  const keys = uniq([...Object.keys(params), ...Object.keys(cleaners)]);
  return keys.reduce<Record<string, any>>((result, key) => {
    const value = params[key];
    const cleanFn = cleaners[key];
    return { ...result, [key]: cleanFn ? cleanFn(value) : value };
  }, {});
};

function formatExecutionFrameHeaders(frame: ExecutionFrame, source?: string) {
  let frameToUse = frame;

  if (source) {
    frameToUse = {
      ...frame,
      customSource: source,
    };
  }

  return JSON.stringify(frameToUse);
}

export const createInvokeFlow = <const TFlows extends Readonly<string[]>>(
  context: ActionContext,
  options: { isCNI?: boolean } = {},
): FlowInvoker<TFlows> => {
  return async (
    flowName: TFlows[number],
    data?: Record<string, unknown>,
    config?: AxiosRequestConfig,
    source?: string,
  ) => {
    const sourceToUse = options.isCNI ? source : undefined;
    return await axios.post(context.webhookUrls[flowName], data, {
      ...config,
      headers: {
        ...(config?.headers ?? {}),
        ...(context.webhookApiKeys[flowName]?.length > 0
          ? {
              "Api-Key": context.webhookApiKeys[flowName][0],
            }
          : {}),
        "prismatic-invoked-by": formatExecutionFrameHeaders(context.executionFrame, sourceToUse),
        "prismatic-invoke-type": "Cross Flow",
        "prismatic-executionid": context.executionId,
      },
    });
  };
};

export const createPerform = (
  performFn: PerformFn,
  { inputCleaners, errorHandler }: CreatePerformProps,
): PerformFn => {
  return async (...args: any[]): Promise<any> => {
    try {
      if (args.length === 1) {
        const [params] = args;
        return await performFn(cleanParams(params, inputCleaners));
      }

      if (args.length === 2) {
        const [context, params] = args;
        const actionContext = {
          ...context,
          debug: createDebugContext(context),
          invokeFlow: createInvokeFlow(context),
        };

        const result = await performFn(actionContext, cleanParams(params, inputCleaners));

        logDebugResults(actionContext);

        return result;
      }

      const [context, payload, params] = args;
      const actionContext = {
        ...context,
        debug: createDebugContext(context),
        invokeFlow: createInvokeFlow(context),
      };

      const result = await performFn(actionContext, payload, cleanParams(params, inputCleaners));

      logDebugResults(actionContext);

      return result;
    } catch (error) {
      throw errorHandler ? errorHandler(error) : error;
    }
  };
};

const createInvokePollAction = <TInputs extends Inputs>(
  context: ActionContext,
  action: ActionDefinition<Inputs> | undefined,
  { errorHandler }: { errorHandler?: ErrorHandler },
): PerformFn => {
  return async (params: ActionInputParameters<TInputs>): Promise<any> => {
    try {
      if (!action) {
        throw "Error: Attempted to invoke an action for a trigger with no pollAction defined.";
      }

      /*
       * By the time this is called, the inputs have already been cleaned
       * as part of the polling trigger setup.
       *
       * Running clean twice can have unwanted behavior depending on how users have implemented
       * their clean functions.
       */
      return await action.perform(
        {
          ...context,
          debug: createDebugContext(context),
        },
        params,
      );
    } catch (error) {
      throw errorHandler ? errorHandler(error) : error;
    }
  };
};

export const createPollingPerform = (
  trigger: PollingTriggerDefinition<
    any,
    ConfigVarResultCollection,
    TriggerPayload,
    boolean,
    any,
    any
  >,
  { inputCleaners, errorHandler }: CreatePerformProps,
): PollingTriggerPerformFunction<Inputs, Inputs> => {
  return async (context, payload, params): Promise<TriggerResult<boolean, any>> => {
    try {
      const { pollAction } = trigger;

      const pollingContext: Partial<PollingContext> = {
        invokeFlow: createInvokeFlow(context),
        polling: {
          invokeAction: createInvokePollAction(context, pollAction, {
            errorHandler,
          }),
          getState: () => {
            const castState =
              (context.instanceState.__prismaticInternal as Record<string, unknown>) ?? {};
            return (castState.polling as Record<string, unknown>) ?? {};
          },
          setState: (newState: Record<string, unknown>) => {
            const castState =
              (context.instanceState.__prismaticInternal as Record<string, unknown>) ?? {};

            context.instanceState.__prismaticInternal = {
              ...castState,
              polling: newState,
            };
          },
        },
        debug: createDebugContext(context),
      };

      const triggerPerform = createPerform(trigger.perform, {
        inputCleaners,
        errorHandler,
      });

      const combinedContext = Object.assign({}, context, pollingContext);

      const { polledNoChanges, ...rest } = await triggerPerform(combinedContext, payload, params);

      return {
        ...rest,
        resultType: polledNoChanges ? "polled_no_changes" : "completed",
      };
    } catch (error) {
      throw errorHandler ? errorHandler(error) : error;
    }
  };
};
