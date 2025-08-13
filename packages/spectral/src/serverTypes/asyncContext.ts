import { AsyncLocalStorage } from "node:async_hooks";
import { ActionContext } from "../types";

const actionContextStorage = new AsyncLocalStorage<ActionContext>();

export function runWithContext<T>(
  context: ActionContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return actionContextStorage.run(context, fn);
}

export function requireContext(): ActionContext {
  const context = actionContextStorage.getStore();

  if (!context) {
    throw new Error("ActionContext not found. Ensure this code is wrapped via runWithContext.");
  }

  return context;
}
