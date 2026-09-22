import { charset, extension } from "mime-types";
import type { ActionContext } from "../types/ActionPerformFunction";
import type { ActionPerformReturn } from "../types/ActionPerformReturn";
import type { PerformFn } from "./perform";

const isTextBuffer = (data: unknown, contentType: unknown): data is Buffer =>
  data instanceof Buffer &&
  typeof contentType === "string" &&
  (charset(contentType) === "UTF-8" ||
    Boolean(extension(`text/${contentType.split("/").slice(-1)[0]}`)));

/**
 * Normalizes an action's raw `perform()` result into an
 * `ActionPerformReturn`, mirroring what the runner's
 * `performActionFunctionExecutor` does for registry-invoked actions today.
 * This is what lets a package-installed action, invoked directly with no
 * registry/runner in the loop, behave the same as `context.components.x.y()`.
 *
 * `ConnectionError`s and `UserError`s are let through unchanged so the platform's
 * behavior there remains unchanged.
 */
export const executeAction = async (
  performFn: PerformFn,
  context: ActionContext,
  params: Record<string, unknown>,
): Promise<ActionPerformReturn<boolean, unknown>> => {
  const initialResult = await performFn(context, params);

  let result: Record<string, unknown> = { data: null };
  if (initialResult !== undefined && initialResult !== null) {
    if ((initialResult as Record<string, unknown>).data === undefined) {
      result.data = initialResult;
    } else {
      result = initialResult as Record<string, unknown>;
    }
  }

  if (isTextBuffer(result.data, result.contentType)) {
    const stringData = (result.data as Buffer).toString("utf-8");
    result.data =
      extension(result.contentType as string) === "json" ? JSON.parse(stringData) : stringData;
  }

  return result as unknown as ActionPerformReturn<boolean, unknown>;
};
