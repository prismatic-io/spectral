import type {
  ComponentRegistry,
  Inputs,
  IntegrationDefinition,
  TriggerPayload,
  TriggerResult,
} from "../types";
import type { ActionContext } from "../types/ActionPerformFunction";

// Only import async_hooks in Node.js environments
const asyncHooks = typeof window === "undefined" ? require("node:async_hooks") : null;

/**
 * A bundler (e.g. a component's own webpack build) can end up shipping its
 * own separate copy of this module alongside the CNI's.
 *
 * `Symbol.for` is a process-wide registry, so keying storage
 * off it here — rather than a plain module-level `const` — makes every copy
 * of spectral in a given process share the same underlying storage, however
 * many times it's been bundled.
 */
const getSharedStorage = (key: string): any => {
  if (!asyncHooks) {
    return null;
  }
  const registryKey = Symbol.for(`@prismatic-io/spectral/${key}`);
  const registry = globalThis as unknown as Record<symbol, any>;
  registry[registryKey] ??= new asyncHooks.AsyncLocalStorage();
  return registry[registryKey];
};

const actionContextStorage = getSharedStorage("actionContextStorage");
const integrationContextStorage = getSharedStorage("integrationContextStorage");

export function runWithContext<T>(
  context: ActionContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  if (!actionContextStorage) {
    return fn();
  }
  return actionContextStorage.run(context, fn);
}

export function requireContext(): ActionContext {
  const context = actionContextStorage.getStore();

  if (!context) {
    throw new Error("ActionContext not found. Ensure this code is wrapped via runWithContext.");
  }

  return context;
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
