import cloneDeepWith from "lodash/cloneDeepWith";
import { localMock, pendingImplementations } from "./localMock";
import type { CallableMockTarget } from "./serverTypes/asyncContext";
import { getCallableMockTarget } from "./serverTypes/callableMock";

type AnyFunction = (...args: any[]) => any;

// Keep optional runner modules external when the SDK is bundled into a component.
const requireRunner = (name: string): any => require(name);

/** Runner-independent declarations; no Jest, Vitest, or Bun types reach consumers. */
export interface FunctionMock<T extends AnyFunction> {
  (...args: Parameters<T>): ReturnType<T>;
  mockImplementation(implementation: T): this;
  mockImplementationOnce(implementation: T): this;
  mockReturnValue(value: ReturnType<T>): this;
  mockReturnValueOnce(value: ReturnType<T>): this;
  mockResolvedValue(
    value: ReturnType<T> extends PromiseLike<unknown> ? Awaited<ReturnType<T>> : never,
  ): this;
  mockResolvedValueOnce(
    value: ReturnType<T> extends PromiseLike<unknown> ? Awaited<ReturnType<T>> : never,
  ): this;
  mockRejectedValue(error: ReturnType<T> extends PromiseLike<unknown> ? unknown : never): this;
  mockRejectedValueOnce(error: ReturnType<T> extends PromiseLike<unknown> ? unknown : never): this;
  mockClear(): this;
  mock: { calls: Parameters<T>[] };
}

type MockFactory = (implementation?: AnyFunction) => any;

const detectMockFactory = async (): Promise<MockFactory> => {
  if (process.env.JEST_WORKER_ID !== undefined && !process.env.VITEST)
    return requireRunner("@jest/globals").jest.fn;

  const { loadRunner } = await import("./testingRunner.mjs");

  return loadRunner();
};

/** Stable function reference, upgraded to a native mock before any harness execution. */
const deferredMock = (initial?: AnyFunction, factory?: MockFactory) => {
  if (factory) return { proxy: factory(initial), initialize: (_factory: MockFactory) => {} };

  let current = localMock(initial);
  let native = false;
  const proxy = new Proxy((...args: unknown[]) => current(...args), {
    apply: (_target, receiver, args) => current.apply(receiver, args),
    has: (_target, key) => key in current,
    get: (_target, key) => {
      const value = current[key];
      if (typeof value !== "function" || typeof key !== "string" || !key.startsWith("mock"))
        return value;
      return (...args: unknown[]) => {
        const result = current[key](...args);

        return result === current ? proxy : result;
      };
    },
  });

  return {
    proxy,
    initialize(factory: MockFactory) {
      if (native) return;

      const next = factory(current.getMockImplementation());
      for (const implementation of pendingImplementations.get(current)?.() ?? []) {
        next.mockImplementationOnce(implementation);
      }

      // Preserve any explicit calls made by the test before run().
      for (const key of ["calls", "contexts", "results"]) next.mock[key].push(...current.mock[key]);
      current = next;
      native = true;
    },
  };
};

export class CallableMocks {
  private mocks = new Map<object, Map<string, ReturnType<typeof deferredMock>>>();
  private factory?: MockFactory;
  private initialization?: Promise<void>;

  constructor() {
    // Bun matchers require an actual native mock, not a forwarding Proxy. Its
    // built-in test module is synchronously loadable and needs no npm dependency.
    if (process.versions.bun && !process.env.VITEST && process.env.JEST_WORKER_ID === undefined) {
      this.factory = requireRunner("bun:test").mock;
    }
  }

  private get(target: CallableMockTarget) {
    let methods = this.mocks.get(target.owner);
    if (!methods) {
      methods = new Map();
      this.mocks.set(target.owner, methods);
    }

    let mock = methods.get(target.method);
    if (!mock) {
      mock = deferredMock(
        target.examplePayload === undefined
          ? undefined
          : () =>
              Promise.resolve(
                cloneDeepWith(target.examplePayload, (value) =>
                  Buffer.isBuffer(value) ? Buffer.from(value) : undefined,
                ),
              ),
        this.factory,
      );
      methods.set(target.method, mock);
    }

    return mock.proxy;
  }

  mock<T extends AnyFunction>(callable: T): FunctionMock<T> {
    const target = getCallableMockTarget(callable);
    if (!target)
      throw new Error(
        "Expected a Spectral callable method. Use a trigger's .perform or a data source's .perform; older component packages may need rebuilding with a newer Spectral.",
      );

    return this.get(target) as unknown as FunctionMock<T>;
  }

  dispatch = (target: CallableMockTarget, args: unknown[]) => this.get(target)(...args);

  initialize(): Promise<void> {
    if (this.factory) return Promise.resolve();

    this.initialization ??= detectMockFactory().then((factory) => {
      this.factory = factory;
      for (const methods of this.mocks.values()) {
        for (const mock of methods.values()) mock.initialize(factory);
      }
    });

    return this.initialization;
  }
}
