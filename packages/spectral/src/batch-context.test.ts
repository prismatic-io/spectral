import { describe, expect, it } from "vitest";
import { flow, trigger } from ".";
import { invokeFlow, invokeTrigger } from "./testing";
import type { BatchInfo } from "./types/BatchContext";

describe("context.batch", () => {
  const echoBatch = trigger({
    display: { label: "Echo Batch", description: "Returns the batch context it saw." },
    inputs: {},
    perform: async (context) => ({
      payload: {
        ...({} as never),
        body: { data: context.batch ?? null },
      },
    }),
    scheduleSupport: "invalid",
    synchronousResponseSupport: "invalid",
  });

  it("reaches a component trigger's perform", async () => {
    const { result } = await invokeTrigger(echoBatch, {
      batch: { enabled: true, batchSize: 50 },
    });
    expect(result?.payload.body.data).toEqual({ enabled: true, batchSize: 50 });
  });

  it("is undefined when the context omits it", async () => {
    const { result } = await invokeTrigger(echoBatch);
    expect(result?.payload.body.data).toBeNull();
  });

  it("carries enabled false through to the perform", async () => {
    const { result } = await invokeTrigger(echoBatch, { batch: { enabled: false } });
    expect(result?.payload.body.data).toEqual({ enabled: false });
  });

  it("exposes batchSize on the enabled variant", () => {
    const disabled: BatchInfo = { enabled: false };
    const enabled: BatchInfo = { enabled: true, batchSize: 25 };
    // @ts-expect-error batchSize belongs to the enabled variant.
    expect(disabled.batchSize).toBeUndefined();
    expect(enabled.enabled ? enabled.batchSize : 0).toBe(25);
  });

  it("reaches a CNI flow's onExecution", async () => {
    const seen: unknown[] = [];
    const cniFlow = flow({
      name: "Batch Aware Flow",
      stableKey: "batch-aware-flow",
      description: "Records the batch context its step body saw.",
      onExecution: async (context) => {
        seen.push(context.batch ?? null);
        return Promise.resolve({ data: null });
      },
    });

    await invokeFlow(cniFlow, { context: { batch: { enabled: true, batchSize: 25 } } });

    expect(seen).toEqual([{ enabled: true, batchSize: 25 }]);
  });
});
