import type { ActionContext } from "../types/ActionPerformFunction";

// Only import async_hooks in Node.js environments
const asyncHooks = typeof window === "undefined" ? require("node:async_hooks") : null;
const actionContextStorage = asyncHooks ? new asyncHooks.AsyncLocalStorage() : null;

export function runWithContext<T>(
  context: ActionContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  if (!actionContextStorage) {
    // This shouldn't be running in a browser environment anyway.
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
