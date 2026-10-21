type AnyFunction = (...args: any[]) => any;

// Keep Bun's optional assertion adapter external when bundling Spectral.
const requireRunner = (name: string): any => require(name);

let invocationOrder = 0;

/** Small local spy for isolated test loggers. */
export const localMock = (initial?: AnyFunction): any => {
  let implementation = initial;
  let once: AnyFunction[] = [];
  let name = "jest.fn()";
  const freshState = () => ({
    calls: [] as unknown[][],
    contexts: [] as unknown[],
    instances: [] as unknown[],
    invocationCallOrder: [] as number[],
    results: [] as unknown[],
    lastCall: undefined as unknown[] | undefined,
  });
  let state = freshState();
  const invoke = function (this: unknown, ...args: unknown[]) {
    state.calls.push(args);
    state.contexts.push(this);
    state.instances.push(this);
    state.invocationCallOrder.push(++invocationOrder);
    state.lastCall = args;
    const result: { type: string; value: unknown } = { type: "incomplete", value: undefined };
    state.results.push(result);
    try {
      result.value = (once.shift() ?? implementation)?.apply(this, args);
      result.type = "return";

      return result.value;
    } catch (error) {
      result.type = "throw";
      result.value = error;
      throw error;
    }
  };
  // Bun's matchers require a native mock identity; all behavior stays in this shim.
  const mock = process.versions.bun ? requireRunner("bun:test").mock(invoke) : invoke;
  const clearAssertions = process.versions.bun ? mock.mockClear.bind(mock) : () => {};
  Object.defineProperties(
    mock,
    Object.getOwnPropertyDescriptors({
      _isMockFunction: true,
      getMockName: () => name,
      mockName: (value: string) => {
        name = value || name;
        return mock;
      },
      getMockImplementation: () => implementation,
      mockClear: () => {
        clearAssertions();
        state = freshState();

        return mock;
      },
      mockReset: () => {
        mock.mockClear();
        implementation = undefined;
        once = [];
        name = "jest.fn()";
        return mock;
      },
      mockRestore: () => {
        mock.mockReset();
      },
      mockReturnThis: () =>
        mock.mockImplementation(() => state.contexts[state.contexts.length - 1]),
      withImplementation: (fn: AnyFunction, callback: () => unknown) => {
        const previous = implementation;
        const previousOnce = once;
        implementation = fn;
        once = [];
        const restore = () => {
          implementation = previous;
          once = previousOnce;
        };
        try {
          const result = callback();
          if (result && typeof (result as Promise<unknown>).then === "function") {
            return Promise.resolve(result)
              .then(() => undefined)
              .finally(restore);
          }
          restore();
        } catch (error) {
          restore();
          throw error;
        }
      },
      mockImplementation: (fn: AnyFunction) => {
        implementation = fn;

        return mock;
      },
      mockImplementationOnce: (fn: AnyFunction) => {
        once.push(fn);

        return mock;
      },
      mockReturnValue: (value: unknown) => mock.mockImplementation(() => value),
      mockReturnValueOnce: (value: unknown) => mock.mockImplementationOnce(() => value),
      mockResolvedValue: (value: unknown) => mock.mockImplementation(() => Promise.resolve(value)),
      mockResolvedValueOnce: (value: unknown) =>
        mock.mockImplementationOnce(() => Promise.resolve(value)),
      mockRejectedValue: (error: unknown) => mock.mockImplementation(() => Promise.reject(error)),
      mockRejectedValueOnce: (error: unknown) =>
        mock.mockImplementationOnce(() => Promise.reject(error)),
    }),
  );
  Object.defineProperty(mock, "mock", {
    enumerable: true,
    get: () => state,
    set: (value) => {
      state = value;
    },
  });
  return mock;
};
