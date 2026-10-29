import { type CallableMockTarget, getCallableMockDispatcher } from "./asyncContext";

export const callableMockSymbol = Symbol.for("@prismatic-io/spectral/callable-mock/v1");

export const getCallableMockTarget = (callable: object): CallableMockTarget | undefined =>
  (callable as { [callableMockSymbol]?: CallableMockTarget })[callableMockSymbol];

export const identifyCallable = <T extends object>(value: T, target: CallableMockTarget): T => {
  Object.defineProperty(value, callableMockSymbol, { value: target });

  return value;
};

/** Dispatch before cleaning or hooks. Factories themselves must not use this wrapper. */
export const mockable = <T extends (...args: any[]) => any>(
  real: T,
  target: CallableMockTarget,
  requireContext: () => unknown,
): T =>
  identifyCallable(
    function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
      const dispatcher = getCallableMockDispatcher();
      if (dispatcher) {
        requireContext();

        return dispatcher(target, args) as ReturnType<T>;
      }

      return real.apply(this, args);
    } as T,
    target,
  );
