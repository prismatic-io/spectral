import axios from "axios";
import { ActionContext } from ".";
import type {
  ActionDefinition,
  ActionInputParameters,
  ErrorHandler,
  Inputs,
  PollingContext,
  PollingTriggerPerformFunction,
  TriggerResult,
} from "../types";
import { type PollingTriggerDefinition } from "../types/PollingTriggerDefinition";
import { uniq } from "lodash";

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
        return await performFn(context, cleanParams(params, inputCleaners));
      }

      const [context, payload, params] = args;
      return await performFn(context, payload, cleanParams(params, inputCleaners));
    } catch (error) {
      throw errorHandler ? errorHandler(error) : error;
    }
  };
};

const createInvokePollAction = <TInputs extends Inputs>(
  context: ActionContext,
  action: ActionDefinition<Inputs> | undefined,
  { inputCleaners, errorHandler }: CreatePerformProps,
): PerformFn => {
  return async (params: ActionInputParameters<TInputs>): Promise<any> => {
    try {
      if (!action) {
        throw "Error: Attempted to invoke an action for a trigger with no pollAction defined.";
      }

      return await action.perform(context, cleanParams(params, inputCleaners));
    } catch (error) {
      throw errorHandler ? errorHandler(error) : error;
    }
  };
};

export const createPollingPerform = (
  trigger: PollingTriggerDefinition,
  { inputCleaners, errorHandler }: CreatePerformProps,
): PollingTriggerPerformFunction<Inputs, Inputs> => {
  return async (context, payload, params): Promise<TriggerResult<boolean, any>> => {
    try {
      const { pollAction } = trigger;

      const pollingContext: Partial<PollingContext> = {
        polling: {
          reinvokeFlow: async (data, config) => {
            return await axios.post(context.invokeUrl, data, config);
          },
          invokeAction: createInvokePollAction(context, pollAction, {
            inputCleaners,
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
