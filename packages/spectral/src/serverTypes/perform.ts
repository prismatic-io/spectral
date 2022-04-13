import { serializeError } from "serialize-error";
import { toJSON } from "../util";
import { ErrorHandler } from "../types";

type PerformFn = (...args: any[]) => Promise<any>;
export type CleanFn = (...args: any[]) => any;

export type InputCleaners = Record<string, CleanFn | undefined>;

interface CreatePerformProps {
  inputCleaners: InputCleaners;
  errorHandler?: ErrorHandler;
}

const cleanParams = (
  params: Record<string, unknown>,
  cleaners: InputCleaners
): Record<string, any> =>
  Object.entries(params).reduce<Record<string, any>>((result, [key, value]) => {
    const cleanFn = cleaners[key];
    return { ...result, [key]: cleanFn ? (cleanFn as CleanFn)(value) : value };
  }, {});

export const createPerform = (
  performFn: PerformFn,
  { inputCleaners, errorHandler }: CreatePerformProps
): PerformFn => {
  return async (...args: any[]): Promise<any> => {
    try {
      if (args.length === 2) {
        const [context, params] = args;
        return await performFn(context, cleanParams(params, inputCleaners));
      }

      const [context, payload, params] = args;
      return await performFn(
        context,
        payload,
        cleanParams(params, inputCleaners)
      );
    } catch (error) {
      if (!errorHandler) {
        throw error;
      }

      const handled = errorHandler(error);
      const serialized = toJSON(serializeError(handled));
      throw new Error(serialized);
    }
  };
};
