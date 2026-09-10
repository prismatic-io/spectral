import type { ActionContext } from "../types/ActionPerformFunction";
import type { HttpResponse } from "../types/HttpResponse";
import type { PollingState } from "../types/PollingTriggerDefinition";
import type { TriggerResolverBehavior } from "../types/TriggerDefinition";
import type { TriggerPayload } from "../types/TriggerPayload";
import { createPollingState } from "./pollingState";

/**
 * What a batched fire returns: the page's records, the next page's cursor, and the optional
 * HTTP response and branch. Both a CNI `batchFlowTrigger` fire and a component `batchTrigger`
 * perform produce this shape; {@link wrapBatchedFire} turns it into a full trigger result.
 */
export interface BatchedFireReturn {
  items: unknown[];
  paginationState?: object | null;
  response?: HttpResponse;
  branch?: string;
  polledNoChanges?: boolean;
}

/** Default `resolveItems`: reads back the items {@link wrapBatchedFire} writes to `payload.body.data`. */
export const defaultResolveItems = (
  _context: ActionContext,
  result: { payload: { body: { data: unknown } } },
) => result.payload.body.data as unknown[];

/**
 * Default `getNextPaginationState`: reads back the cursor {@link wrapBatchedFire} writes to
 * `payload.paginationState`, defaulting to `null` so the run ends after the last page.
 */
export const defaultGetNextPaginationState = (
  _context: ActionContext,
  result: { payload: { paginationState?: object | null } },
) => result.payload.paginationState ?? null;

/** The resolver `batchTrigger` and `batchFlowTrigger` attach to every batched trigger. */
export const defaultBatchResolver: TriggerResolverBehavior = {
  resolveItems: defaultResolveItems,
  getNextPaginationState: defaultGetNextPaginationState,
};

/**
 * Adds `context.polling` to a batched perform so it can read and advance a watermark between
 * runs. State lives on the instance, as it does for a polling trigger.
 */
export const withPollingState =
  <TContext extends ActionContext, TRest extends unknown[], TReturn>(
    perform: (context: TContext & { polling: PollingState }, ...rest: TRest) => Promise<TReturn>,
  ) =>
  (context: TContext, ...rest: TRest): Promise<TReturn> =>
    perform({ ...context, polling: createPollingState(context) }, ...rest);

/**
 * Wraps a batched fire (returning `{ items, paginationState?, response?, branch?, polledNoChanges? }`) into a
 * trigger perform whose result carries the items at `payload.body.data` and the next-page
 * cursor at `payload.paginationState`, `null` after the last page. Every argument is forwarded,
 * so the two-argument CNI fire and the three-argument component perform both fit. The fire has
 * already read the incoming cursor, so the returned one replaces it for
 * `getNextPaginationState` to read back. `polledNoChanges` describes the whole execution, so
 * only the first page (the one without an incoming `paginationState`) forwards it.
 */
export const wrapBatchedFire =
  <TArgs extends [ActionContext, TriggerPayload, ...unknown[]]>(
    fire: (...args: TArgs) => Promise<BatchedFireReturn>,
  ) =>
  async (...args: TArgs) => {
    const payload = args[1];
    const { items, paginationState, response, branch, polledNoChanges } = await fire(...args);
    const isFirstPage = !payload.paginationState;
    return {
      payload: {
        ...payload,
        body: { data: items, contentType: "application/json" },
        paginationState: paginationState ?? null,
      },
      ...(response ? { response } : {}),
      ...(branch !== undefined ? { branch } : {}),
      ...(isFirstPage && polledNoChanges !== undefined ? { polledNoChanges } : {}),
    };
  };

/**
 * Maps a batched perform's `polledNoChanges` onto the `resultType` the platform reads. The
 * polling wrappers do this for `pollingTrigger` and CNI flows; a component `batchTrigger` runs
 * through the plain trigger wrapper, so it carries its own mapping.
 */
export const withPolledResultType =
  <TArgs extends unknown[], TResult extends { polledNoChanges?: boolean }>(
    perform: (...args: TArgs) => Promise<TResult>,
  ) =>
  async (...args: TArgs) => {
    const { polledNoChanges, ...rest } = await perform(...args);
    return {
      ...rest,
      resultType: polledNoChanges ? ("polled_no_changes" as const) : ("completed" as const),
    };
  };
