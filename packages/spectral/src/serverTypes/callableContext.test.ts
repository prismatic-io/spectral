import { describe, expect, it } from "vitest";
import type { ActionContext, TriggerPayload } from "../types";
import { requireContext } from "./asyncContext";
import { createCNIPerform, createCNIPollingPerform } from "./perform";

const contextFor = (executionId: string) =>
  ({ executionId, instanceState: {}, configVars: {}, globalDebug: false }) as ActionContext;
const payload = {} as TriggerPayload;

describe("CNI trigger execution context", () => {
  it("keeps concurrent standard trigger contexts separate across awaits", async () => {
    const perform = createCNIPerform({
      componentRegistry: {},
      onTrigger: async (context, payload) => {
        await Promise.resolve();
        expect(requireContext()).toBe(context);
        return { payload: { ...payload, executionId: requireContext().executionId } };
      },
    });

    const results = await Promise.all(
      ["first", "second"].map((id) => perform(contextFor(id), payload, {})),
    );
    expect(results.map((result) => result?.payload.executionId)).toEqual(["first", "second"]);
    expect(() => requireContext()).toThrow("ActionContext not found");
  });

  it("exposes the complete polling context and preserves polling results", async () => {
    const perform = createCNIPollingPerform({
      componentRegistry: {},
      onTrigger: async (context, payload) => {
        await Promise.resolve();
        expect(requireContext()).toBe(context);
        context.polling.setState({ cursor: "next" });
        return { payload, polledNoChanges: true };
      },
    });
    const context = contextFor("poll");
    const result = await perform(context, payload, {});
    expect(result?.resultType).toBe("polled_no_changes");
    expect(context.instanceState).toEqual({
      __prismaticInternal: { polling: { cursor: "next" } },
    });
    expect(() => requireContext()).toThrow("ActionContext not found");
  });
});
