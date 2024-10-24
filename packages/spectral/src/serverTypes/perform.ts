import type { ErrorHandler, Inputs } from "../types";
import type {
  PollingTriggerDefinition,
  PollingTriggerFilterableValue,
} from "../types/PollingTriggerDefinition";
import { Input } from ".";

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
  trigger: PollingTriggerDefinition<Inputs, any, any, any>,
  inputs: Input[],
  { inputCleaners, errorHandler }: CreatePerformProps,
): PerformFn => {
  return async (context, payload, params): Promise<any> => {
    try {
      context.logger.info("trigger params", params);

      // Perform action with cleaned inputs
      const { pollAction, filterBy } = trigger;
      const pollActionReturn: { data: unknown } = await pollAction.perform(
        context,
        cleanParams(params, inputCleaners),
      );
      const polledData = Array.isArray(pollActionReturn.data)
        ? pollActionReturn.data
        : [pollActionReturn.data];

      // Filter
      const currentFilterValue: PollingTriggerFilterableValue =
        context.instanceState.__prismatic_internal_poll_filter_value || 0;
      let nextFilterValue: PollingTriggerFilterableValue = currentFilterValue;

      const filteredData = polledData.filter((data) => {
        const filterValue = filterBy(data);
        if (filterValue > nextFilterValue) {
          nextFilterValue = filterValue;
        }
        return filterValue > currentFilterValue;
      });

      const branch = filteredData.length > 0 ? "Results" : "No Results";
      context.instanceState.__prismatic_internal_poll_filter_value = nextFilterValue;

      // Respond w/ filtered items
      return Promise.resolve({
        branch,
        payload: {
          ...payload,
          ...pollActionReturn,
          data: filteredData,
        },
      });
    } catch (error) {
      throw errorHandler ? errorHandler(error) : error;
    }
  };
};
