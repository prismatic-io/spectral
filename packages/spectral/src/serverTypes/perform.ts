import type {
  ActionContext,
  ActionDefinition,
  ActionInputParameters,
  CodeNativePollingTriggerPerformFunction,
  ComponentRegistry,
  ConfigVarResultCollection,
  ErrorHandler,
  Inputs,
  PollingContext,
  PollingTriggerDefinition,
  PollingTriggerPerformFunction,
  TriggerPayload,
  TriggerReference,
  TriggerResult,
} from "../types";
import { TriggerPerformFunction } from ".";
import { invokeTriggerComponentInput, TriggerActionInvokeFunction } from "./convertIntegration";
import { ComponentReference as ServerComponentReference } from "./integration";

import uniq from "lodash/uniq";
import { createCNIContext, createDebugContext, createInvokeFlow, logDebugResults } from "./context";

export type PerformFn = (...args: any[]) => Promise<any>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface CreatePollingContext {
  context: ActionContext;
  invokeAction: PollingContext["polling"]["invokeAction"];
}

export const createPollingContext = ({
  context,
  invokeAction,
}: CreatePollingContext): Pick<PollingContext, "polling"> => {
  return {
    polling: {
      invokeAction,
      getState: () => {
        const internal = context.instanceState.__prismaticInternal;
        const internalState = isRecord(internal) ? internal : {};
        return isRecord(internalState.polling) ? internalState.polling : {};
      },
      setState: (newState: Record<string, unknown>) => {
        const internal = context.instanceState.__prismaticInternal;
        const internalState = isRecord(internal) ? internal : {};
        context.instanceState.__prismaticInternal = {
          ...internalState,
          polling: newState,
        };
      },
    },
  };
};

export type CleanFn = (...args: any[]) => any;
export type InputCleaners = Record<string, CleanFn | undefined>;

interface CreatePerformProps {
  inputCleaners: InputCleaners;
  errorHandler?: ErrorHandler;
}

export const cleanParams = (
  params: Record<string, unknown>,
  cleaners: InputCleaners,
): Record<string, unknown> => {
  const keys = uniq([...Object.keys(params), ...Object.keys(cleaners)]);
  return keys.reduce<Record<string, any>>((result, key) => {
    const value = params[key];
    const cleanFn = cleaners[key];
    return { ...result, [key]: cleanFn ? cleanFn(value) : value };
  }, {});
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
      throw errorHandler ? await errorHandler(error) : error;
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
      throw errorHandler ? await errorHandler(error) : error;
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
        ...createPollingContext({
          context,
          invokeAction: createInvokePollAction(context, pollAction, { errorHandler }),
        }),
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
      throw errorHandler ? await errorHandler(error) : error;
    }
  };
};

interface CreateCNIPollingPerform {
  componentRegistry: ComponentRegistry;
  onTrigger: CodeNativePollingTriggerPerformFunction;
}

export const createCNIPollingPerform = ({
  onTrigger,
  componentRegistry,
}: CreateCNIPollingPerform): CodeNativePollingTriggerPerformFunction => {
  return async (context, payload, params): Promise<TriggerResult<boolean, any>> => {
    try {
      const cniContext = createCNIContext(context, componentRegistry);
      const finalContext = {
        ...cniContext,
        ...createPollingContext({
          context: cniContext,
          invokeAction: async () => {
            throw new Error(
              "invokeAction is not available for code-native polling triggers. " +
                "Use getState/setState to manage polling state directly in your onTrigger function.",
            );
          },
        }),
      };

      const { polledNoChanges, ...rest } = await onTrigger(finalContext, payload, params);

      return {
        ...rest,
        resultType: polledNoChanges ? "polled_no_changes" : "completed",
      };
    } catch (error) {
      throw errorHandler ? await errorHandler(error) : error;
    }
  };
};

interface CreateCNIComponentRefPerform {
  componentRef: ServerComponentReference;
  componentRegistry: ComponentRegistry;
  onTrigger: TriggerReference;
}

export const createCNIComponentRefPerform = ({
  componentRegistry,
  componentRef,
  onTrigger,
}: CreateCNIComponentRefPerform): TriggerPerformFunction => {
  return async (context, payload, params) => {
    // @ts-expect-error: _components isn't part of the public API
    const _components = context._components ?? {
      invokeTrigger: () => {},
    };
    const invokeTrigger: TriggerActionInvokeFunction = _components.invokeTrigger;
    const cniContext = createCNIContext(context, componentRegistry);

    return await invokeTrigger(
      invokeTriggerComponentInput(componentRef, onTrigger, "perform"),
      cniContext,
      payload,
      params,
    );
  };
};

interface CreateCNIPerform {
  componentRegistry: ComponentRegistry;
  onTrigger: TriggerPerformFunction;
}

export const createCNIPerform = ({
  componentRegistry,
  onTrigger,
}: CreateCNIPerform): TriggerPerformFunction => {
  return async (context, payload, params) => {
    const cniContext = createCNIContext(context, componentRegistry);
    return await onTrigger(cniContext, payload, params);
  };
};
