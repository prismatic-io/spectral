import { ComponentRegistry, IntegrationDefinition } from "../types";
import type { ActionContext } from "../types/ActionPerformFunction";

// Only import async_hooks in Node.js environments
const asyncHooks = typeof window === "undefined" ? require("node:async_hooks") : null;
const actionContextStorage = asyncHooks ? new asyncHooks.AsyncLocalStorage() : null;
const integrationContextStorage = asyncHooks ? new asyncHooks.AsyncLocalStorage() : null;

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

export function runWithIntegrationContext<T extends IntegrationDefinition, U>(
  context: T,
  fn: () => U,
): U {
  if (!integrationContextStorage) {
    console.warn(
      "Creating integration without context. This may result in errors when generating component manifests.",
    );

    return fn();
  }

  return integrationContextStorage.run(context, fn);
}

export function requireIntegrationContext<T extends IntegrationDefinition>(): T {
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
    ? T[UserKey]["key"] extends K
      ? T[UserKey]["public"] extends TPublic
        ? UserKey
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
