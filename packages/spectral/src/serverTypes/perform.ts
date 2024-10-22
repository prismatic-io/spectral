import type { ErrorHandler, Inputs } from "../types";
import type {
  PolledResource,
  PollingTriggerDefinition,
  PollingTriggerFilterableValue,
} from "../types/PollingTriggerDefinition";

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
  { inputCleaners, errorHandler }: CreatePerformProps,
): PerformFn => {
  return async (...args: any[]): Promise<any> => {
    try {
      // Perform action with cleaned inputs
      const [context, params] = args;
      const { action, filterBy, getPolledResources } = trigger;

      const actionReturn = await action.perform(context, cleanParams(params, inputCleaners));
      const polledData = getPolledResources
        ? getPolledResources(actionReturn)
        : actionReturn?.data ?? [];

      if (!Array.isArray(polledData)) {
        throw new Error(`Polled data was not an array: ${polledData}`);
      }

      // Filter
      const currentFilterValue: PollingTriggerFilterableValue =
        context.instanceState.__prismatic_internal_poll_filter_value || 0;
      let nextFilterValue: PollingTriggerFilterableValue =
        context.instanceState.__prismatic_internal_poll_filter_value || 0;

      const filteredData = polledData.filter((data) => {
        const filterValue = filterBy(data);
        if (filterValue > nextFilterValue) {
          nextFilterValue = filterValue;
        }
        return filterValue > currentFilterValue;
      });

      const branch = filteredData.length > 0 ? "Results" : "No Results";
      context.instance.__prismatic_internal_poll_filter_value = nextFilterValue;

      // Respond w/ filtered items
      return Promise.resolve({
        branch,
        payload: {
          ...actionReturn,
          data: filteredData,
        },
      });
    } catch (error) {
      throw errorHandler ? errorHandler(error) : error;
    }
  };
};
