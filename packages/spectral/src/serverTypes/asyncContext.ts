import type {
  ComponentRegistry,
  Inputs,
  IntegrationDefinition,
  TriggerPayload,
  TriggerResult,
} from "../types";
import type { ActionContext } from "../types/ActionPerformFunction";
import type { DataSourceContext } from "../types/DataSourcePerformFunction";

// Only import async_hooks in Node.js environments
const asyncHooks = typeof window === "undefined" ? require("node:async_hooks") : null;
const sharedStorage = globalThis as typeof globalThis & Record<symbol, unknown>;
const actionContextStorageKey = Symbol.for("@prismatic-io/spectral/action-context");
const integrationContextStorageKey = Symbol.for("@prismatic-io/spectral/integration-context");

const getSharedContextStorage = (key: symbol) => {
  if (!asyncHooks) return null;
  const existing = sharedStorage[key];
  if (existing) return existing as InstanceType<typeof asyncHooks.AsyncLocalStorage>;

  const storage = new asyncHooks.AsyncLocalStorage();
  sharedStorage[key] = storage;
  return storage;
};

const actionContextStorage = getSharedContextStorage(actionContextStorageKey);
const integrationContextStorage = getSharedContextStorage(integrationContextStorageKey);

/**
 * What a bundled component call can resolve ambiently: a flow execution's full context, or
 * the narrower one configuration-time callbacks (data sources, `init`, server functions) get.
 */
type InvocationScope =
  | { kind: "execution"; context: ActionContext }
  | { kind: "dataSource"; context: DataSourceContext };

export function runWithContext<T>(context: ActionContext, fn: () => T): T {
  if (!actionContextStorage) {
    return fn();
  }
  return actionContextStorage.run({ kind: "execution", context } satisfies InvocationScope, fn);
}

export function requireContext(): ActionContext {
  const scope = actionContextStorage?.getStore() as InvocationScope | undefined;

  if (!scope) {
    throw new Error("ActionContext not found. Ensure this code is wrapped via runWithContext.");
  }

  if (scope.kind !== "execution") {
    throw new Error(
      "ActionContext is unavailable during configuration. Invoke a data source instead.",
    );
  }

  return scope.context;
}

/** Configuration callbacks supply the smaller context data sources get. */
export function runWithDataSourceContext<T>(context: DataSourceContext, fn: () => T): T {
  if (!actionContextStorage) {
    return fn();
  }
  return actionContextStorage.run({ kind: "dataSource", context } satisfies InvocationScope, fn);
}

/** The ambient context a bundled data source may use: either kind of scope supplies it. */
export function requireDataSourceContext(): DataSourceContext {
  const scope = actionContextStorage?.getStore() as InvocationScope | undefined;
  if (!scope) {
    throw new Error(
      "DataSourceContext not found. Invoke within an execution or configuration callback.",
    );
  }
  return scope.context;
}

export function runWithIntegrationContext<
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
>(context: T, fn: () => U): U {
  if (!integrationContextStorage) {
    console.warn(
      "Creating integration without context. This may result in errors when generating component manifests.",
    );

    return fn();
  }

  return integrationContextStorage.run(context, fn);
}

export function requireIntegrationContext<
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
>(): T {
  const context = integrationContextStorage.getStore();

  if (!context) {
    console.trace();
    throw new Error(
      "IntegrationContext not found. Ensure this code is wrapped via runWithIntegrationContext.",
    );
  }

  return context;
}

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
