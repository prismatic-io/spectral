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
    throw new Error(
      "IntegrationContext not found. Ensure this code is wrapped via runWithIntegrationContext.",
    );
  }

  return context;
}

export const findUserDefinedComponentKey = <T extends ComponentRegistry>(
  componentKey: string,
  registry?: T,
): keyof T => {
  if (!registry) {
    throw new Error(
      "Error locating component registry. Do you have a component registry defined on your integration?",
    );
  }

  const userKey = Object.keys(registry).find((userKey) => {
    return registry[userKey].key === componentKey;
  });

  if (!userKey) {
    throw new Error(
      `Error locating component ${componentKey} in the component registry. Is this component properly installed?`,
    );
  }

  return userKey;
};
