import type { AsyncLocalStorage } from "node:async_hooks";
import type {
  ComponentRegistry,
  DataSourceContext,
  Inputs,
  IntegrationDefinition,
  TriggerPayload,
  TriggerResult,
} from "../types";
import type { ActionContext } from "../types/ActionPerformFunction";

// Only import async_hooks in Node.js environments
const asyncHooks = typeof window === "undefined" ? require("node:async_hooks") : null;
type InvocationContext =
  | { kind: "execution"; context: ActionContext }
  | { kind: "dataSource"; context: DataSourceContext };

// Peer dependencies can still resolve to multiple copies in one bundle. Share stores
// within the JS realm so every copy sees the same scope. These keys identify the
// stored-value protocol; incompatible shapes must use a different key.
const sharedStorage = globalThis as typeof globalThis & Record<symbol, unknown>;
const getSharedContextStorage = <T>(name: string): AsyncLocalStorage<T> | null => {
  if (!asyncHooks) return null;
  const key = Symbol.for(name);
  sharedStorage[key] ??= new asyncHooks.AsyncLocalStorage();
  return sharedStorage[key] as AsyncLocalStorage<T>;
};
const actionContextStorage = getSharedContextStorage<InvocationContext>(
  "@prismatic-io/spectral/action-context",
);
const integrationContextStorage = getSharedContextStorage<unknown>(
  "@prismatic-io/spectral/integration-context",
);

/** Optional callable dispatch, shared across SDK copies without importing testing code. */
export interface CallableMockTarget {
  owner: object;
  method: string;
  examplePayload?: unknown;
}
export type CallableMockDispatcher = (target: CallableMockTarget, args: unknown[]) => unknown;
const callableMockStorage = getSharedContextStorage<CallableMockDispatcher>(
  "@prismatic-io/spectral/callable-mocks/v1",
);
export const getCallableMockDispatcher = () => callableMockStorage?.getStore();
export const runWithCallableMocks = <T>(dispatcher: CallableMockDispatcher, fn: () => T): T => {
  if (!callableMockStorage) throw new Error("Callable mocking requires Node.js or Bun.");
  return callableMockStorage.run(dispatcher, fn);
};

export const runWithContext = <T>(context: ActionContext, fn: () => T): T => {
  if (!actionContextStorage) {
    return fn();
  }
  return actionContextStorage.run({ kind: "execution", context }, fn);
};

/** CNI execution boundary: bind and pass the same fully prepared context to the callback.
 * Conventional component conversion must not use this adapter.
 */
export const invokeWithContext = <TContext extends ActionContext, TArgs extends unknown[], TResult>(
  context: TContext,
  callback: (context: TContext, ...args: TArgs) => TResult,
  ...args: TArgs
): TResult => runWithContext(context, () => callback(context, ...args));

export const requireContext = (): ActionContext => {
  const scope = actionContextStorage?.getStore();

  if (!scope) {
    throw new Error("ActionContext not found. Ensure this code is wrapped via runWithContext.");
  }

  if (scope.kind !== "execution") {
    throw new Error(
      "ActionContext is unavailable during configuration. Invoke a data source instead.",
    );
  }

  return scope.context;
};

/** Configuration callbacks supply the smaller context supported by data sources. */
export const runWithDataSourceContext = <T>(context: DataSourceContext, fn: () => T): T =>
  actionContextStorage ? actionContextStorage.run({ kind: "dataSource", context }, fn) : fn();

export const requireDataSourceContext = (): DataSourceContext => {
  const scope = actionContextStorage?.getStore();
  if (!scope) {
    throw new Error(
      "DataSourceContext not found. Invoke within an execution or configuration callback.",
    );
  }
  return scope.context;
};

export const runWithIntegrationContext = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
  T extends IntegrationDefinition<
    TInputs,
    TActionInputs,
    TPayload,
    TAllowsBranching,
    TResult
  > = IntegrationDefinition<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>,
  U = unknown,
>(
  context: T,
  fn: () => U,
): U => {
  if (!integrationContextStorage) {
    console.warn(
      "Creating integration without context. This may result in errors when generating component manifests.",
    );

    return fn();
  }

  return integrationContextStorage.run(context, fn);
};

export const requireIntegrationContext = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
  T extends IntegrationDefinition<
    TInputs,
    TActionInputs,
    TPayload,
    TAllowsBranching,
    TResult
  > = IntegrationDefinition<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>,
>(): T => {
  const context = integrationContextStorage?.getStore();

  if (!context) {
    console.trace();
    throw new Error(
      "IntegrationContext not found. Ensure this code is wrapped via runWithIntegrationContext.",
    );
  }

  return context as T;
};

type GetUserDefinedKeyByComponentKey<
  K extends string,
  T extends ComponentRegistry,
  TPublic extends boolean,
> = keyof T extends infer UserKey
  ? UserKey extends keyof T
    ? T[UserKey] extends { key: string; public: boolean }
      ? T[UserKey]["key"] extends K
        ? T[UserKey]["public"] extends TPublic
          ? UserKey
          : never
        : never
      : never
    : never
  : never;

export const findUserDefinedComponentKey = <
  K extends string,
  T extends ComponentRegistry,
  TPublic extends boolean,
>(
  componentKey: K,
  isPublic: TPublic,
  registry?: T,
): GetUserDefinedKeyByComponentKey<K, T, TPublic> => {
  if (!registry) {
    throw new Error(
      "Error locating component registry. Is there a component registry defined on your integration?",
    );
  }

  const userKey = Object.keys(registry).find((userKey) => {
    return registry[userKey].key === componentKey && registry[userKey].public === isPublic;
  });

  if (!userKey) {
    throw new Error(
      `Error locating component ${componentKey} with custom key ${userKey} in the component registry. Is this component properly installed with a correct public/private setting?`,
    );
  }

  return userKey as GetUserDefinedKeyByComponentKey<K, T, TPublic>;
};
