import type { ErrorHandler, Inputs } from "../types";
import {
  isPollingTriggerDefaultDefinition,
  type PollingTriggerDefinition,
  type PollingTriggerFilterableValue,
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
  trigger: PollingTriggerDefinition<Inputs, any, any, any, any, any>,
  { inputCleaners, errorHandler }: CreatePerformProps,
  triggerPerform?: PerformFn,
): PerformFn => {
  return async (context, payload, params): Promise<any> => {
    try {
      // Perform action with mapped & cleaned inputs
      const { pollAction } = trigger;
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

      const pollActionResponse = await action.perform(
        context,
        cleanParams(merge(params, mappedInputs), inputCleaners),
      );

      const unformattedFilterValue =
        (currentFlowState.pollComparisonValue || params.__prismatic_first_starting_value) ?? 0;

      const valueType = trigger.pollAction.filterValueType;
      const currentFilterValue: PollingTriggerFilterableValue =
        trigger.pollAction.filterValueType === "number"
          ? unformattedFilterValue
          : new Date(unformattedFilterValue);

      // If given a custom perform, we need to pass the action response to it
      if (triggerPerform) {
        const triggerResponse = await triggerPerform(
          context,
          {
            ...payload,
            body: {
              data: {
                pollComparisonValue: currentFilterValue,
                actionResponse: pollActionResponse,
              },
            },
          },
          params,
        );

        const internalState = Object.assign({}, currentFlowState, {
          pollComparisonValue: triggerResponse.pollComparisonValue,
        });
        context.instanceState.__prismaticInternal = internalState;

        return triggerResponse;
      }

      // Moving forward with the default polling perform behavior
      const getResults = "getResults" in pollAction ? pollAction.getResults : undefined;
      const unwrappedData = getResults
        ? getResults(pollActionResponse.data as Record<string, unknown>)
        : pollActionResponse.data;
      const polledData = Array.isArray(unwrappedData) ? unwrappedData : [unwrappedData];

      let filteredData: Array<unknown> = [];
      const filterBy = "filterBy" in pollAction ? pollAction.filterBy : undefined;

      // Filter
      if (isPollingTriggerDefaultDefinition(trigger) && filterBy) {
        let nextFilterValue: PollingTriggerFilterableValue = currentFilterValue;

        filteredData = polledData.filter((data) => {
          const rawValue = filterBy(data);
          const filterValue = valueType === "date" ? new Date(rawValue) : rawValue;

          if (filterValue > nextFilterValue) {
            nextFilterValue = filterValue;
          }

          return filterValue > currentFilterValue;
        });

        const internalState = Object.assign({}, currentFlowState, {
          pollComparisonValue: nextFilterValue,
        });
        context.instanceState.__prismaticInternal = internalState;
      } else {
        filteredData = polledData;
      }

      const branch = filteredData.length > 0 ? "Results" : "No Results";

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
