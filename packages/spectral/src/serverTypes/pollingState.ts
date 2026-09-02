import type { ActionContext, PollingState } from "../types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Builds the `getState`/`setState` pair that stores polling state on the instance. */
export const createPollingState = (context: ActionContext): PollingState => ({
  getState: () => {
    const internal = context.instanceState.__prismaticInternal;
    const internalState = isRecord(internal) ? internal : {};
    return isRecord(internalState.polling) ? internalState.polling : {};
  },
  setState: (newState: Record<string, unknown>) => {
    const internal = context.instanceState.__prismaticInternal;
    const internalState = isRecord(internal) ? internal : {};
    context.instanceState.__prismaticInternal = {
      ...internalState,
      polling: newState,
    };
  },
});
