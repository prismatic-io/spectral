import type { ErrorHandler, Inputs } from "../types";
import type {
  PollingTriggerDefinition,
  PollingTriggerFilterableValue,
} from "../types/PollingTriggerDefinition";
import { Input } from ".";
import { merge } from "lodash";

export type PerformFn = (...args: any[]) => Promise<any>;
export type CleanFn = (...args: any[]) => any;

export type InputCleaners = Record<string, CleanFn | undefined>;

interface CreatePerformProps {
  inputCleaners: InputCleaners;
  errorHandler?: ErrorHandler;
}

const cleanParams = (
  params: Record<string, unknown>,
  cleaners: InputCleaners,
): Record<string, any> =>
  Object.entries(params).reduce<Record<string, any>>((result, [key, value]) => {
    const cleanFn = cleaners[key];
    return { ...result, [key]: cleanFn ? cleanFn(value) : value };
  }, {});

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

export const createPollingPerform = (
  trigger: PollingTriggerDefinition<Inputs, any, any, any, any>,
  { inputCleaners, errorHandler }: CreatePerformProps,
  triggerPerform?: PerformFn,
): PerformFn => {
  return async (context, payload, params): Promise<any> => {
    try {
      // Perform action with mapped & cleaned inputs
      const { pollAction, filterBy } = trigger;
      const { action, inputMap = {} } = pollAction;
      const currentFlowState = context.instanceState.__prismaticInternal ?? {};

      const mappedInputs = Object.entries(inputMap).reduce<{ [key: string]: unknown }>(
        (accum, [key, getValue]) => {
          if (getValue) {
            const resolvedValue = getValue(context, payload, params);
            accum[key] = resolvedValue;
          }
          return accum;
        },
        {},
      );

      const pollActionResponse: { data: unknown } = await action.perform(
        context,
        cleanParams(merge(params, mappedInputs), inputCleaners),
      );

      if (triggerPerform) {
        const triggerResponse = await triggerPerform(
          context,
          {
            ...payload,
            body: {
              ...payload.body,
              ...pollActionResponse,
            },
          },
          params,
        );

        currentFlowState.pollComparisonValue = triggerResponse.pollComparisonValue;

        return triggerResponse;
      }

      const polledData = Array.isArray(pollActionResponse.data)
        ? pollActionResponse.data
        : [pollActionResponse.data];

      // Filter
      const currentFilterValue: PollingTriggerFilterableValue =
        currentFlowState.pollComparisonValue || 0;
      let nextFilterValue: PollingTriggerFilterableValue = currentFilterValue;

      const filteredData = polledData.filter((data) => {
        const filterValue = filterBy(data);
        if (filterValue > nextFilterValue) {
          nextFilterValue = filterValue;
        }

        return filterValue > currentFilterValue;
      });

      const branch = filteredData.length > 0 ? "Results" : "No Results";
      context.instanceState.__prismaticInternal = Object.assign(currentFlowState, {
        pollComparisonValue: nextFilterValue,
      });

      // Respond w/ filtered items
      return Promise.resolve({
        branch,
        payload: {
          ...payload,
          body: {
            ...pollActionResponse,
            data: filteredData,
          },
        },
      });
    } catch (error) {
      throw errorHandler ? errorHandler(error) : error;
    }
  };
};
