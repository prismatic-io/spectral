import assert from "node:assert/strict";
import { describe, expect, it, vi } from "vitest";
import {
  batchFlowTrigger,
  batchTrigger,
  callableComponent,
  component,
  flow,
  pollingTrigger,
  trigger,
} from ".";
import { createHarness, defaultTriggerPayload } from "./testing";

const display = { label: "Batch", description: "Batch", iconPath: "icon.png" };
const payload = defaultTriggerPayload();
const required = <T>(value: T | undefined): T => {
  assert(value !== undefined);

  return value;
};

const base = { name: "Batch flow", stableKey: "batch-flow" };
const gate = () => {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { promise, release };
};

const waitFor = (signal: Promise<unknown>, run: Promise<unknown>) =>
  Promise.race([
    signal,
    run.then(() => {
      throw new Error("Harness finished before reaching the expected execution gate");
    }),
  ]);

const createCallable = () => {
  const real = vi.fn((): never => {
    throw new Error("Callable code must never execute");
  });

  const calls = callableComponent(
    component({
      key: "batch-fixture",
      display,
      triggers: {
        batch: batchTrigger({
          display,
          inputs: {},
          scheduleSupport: "valid",
          batchConfig: { batchSize: 2 },
          perform: real,
          onDeploy: { inputs: {}, perform: real },
        }),
        poll: pollingTrigger({
          display,
          inputs: {},
          perform: real,
        }),
      },
    }),
  );

  return { calls, real };
};

const test = it.extend<{
  callable: ReturnType<typeof createCallable>;
  work: {
    gate: typeof gate;
    track: <T>(run: Promise<T>) => Promise<T>;
  };
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest fixtures require destructuring their context.
  callable: async ({}, use) => {
    await use(createCallable());
  },
  // biome-ignore lint/correctness/noEmptyPattern: Vitest fixtures require destructuring their context.
  work: async ({}, use) => {
    const gates: ReturnType<typeof gate>[] = [];
    const runs: Promise<unknown>[] = [];
    try {
      await use({
        gate: () => {
          const pending = gate();
          gates.push(pending);
          return pending;
        },
        track: (run) => {
          // Observe rejections immediately; the test still asserts on the original promise.
          runs.push(run.catch(() => {}));
          return run;
        },
      });
    } finally {
      for (const pending of gates) pending.release();
      await Promise.all(runs);
    }
  },
});

describe("flow harness polling and batching", () => {
  test("executes CNI polling logic, preserves watermarks, and skips unchanged polls", async () => {
    const executions = vi.fn();
    const tested = flow({
      ...base,
      triggerType: "polling",
      schedule: { value: "* * * * *" },
      onTrigger: async (context, input) => {
        const previous = context.polling.getState().watermark;
        context.polling.setState({ watermark: 1 });

        return { payload: input, polledNoChanges: previous === 1 };
      },
      onExecution: async () => {
        executions();

        return { data: "processed" };
      },
    });

    const harness = createHarness(tested);

    expect(await harness.run()).toMatchObject({
      status: "completed",
      result: { data: "processed" },
    });

    expect(await harness.run()).toMatchObject({
      status: "skipped",
      reason: "polledNoChanges",
      results: [],
    });

    expect(executions).toHaveBeenCalledTimes(1);
    expect(await createHarness(tested).run()).toMatchObject({ status: "completed" });
  });

  test("never executes an imported polling trigger, including on unchanged polls", async ({
    callable: { calls, real },
  }) => {
    const executed = vi.fn();
    const harness = createHarness(
      flow({ ...base, onTrigger: calls.triggers.poll({}), onExecution: executed }),
    );
    harness.mock(calls.triggers.poll.perform).mockResolvedValue({ payload, polledNoChanges: true });

    expect((await harness.run()).status).toBe("skipped");
    expect(executed).not.toHaveBeenCalled();
    expect(real).not.toHaveBeenCalled();
  });

  test.each([
    1, 2, 10,
  ])("paginates real CNI discovery and dispatches batchSize %i", async (batchSize) => {
    const cursors: unknown[] = [];
    const batches: unknown[] = [];
    const harness = createHarness(
      flow({
        ...base,
        batchConfig: { batchSize },
        trigger: batchFlowTrigger<number, { page: number }>({
          onTrigger: async (context, incoming) => {
            cursors.push(incoming.paginationState);

            expect(context.batch).toEqual({ enabled: true, batchSize });

            return incoming.paginationState
              ? { items: [4] }
              : { items: [1, 2, 3], paginationState: { page: 2 } };
          },
        }),
        onExecution: async (context, params) => {
          expect(context.batch).toEqual({ enabled: true, batchSize });
          batches.push(params.onTrigger.results.body.data);

          return { data: params.onTrigger.results.body.data };
        },
      }),
    );

    const result = await harness.run();

    expect(cursors).toEqual([undefined, { page: 2 }]);
    expect(batches).toEqual(
      batchSize === 1 ? [1, 2, 3, 4] : batchSize === 2 ? [[1, 2], [3], [4]] : [[1, 2, 3], [4]],
    );

    expect(result).toMatchObject({
      status: "batched",
      pages: 2,
      results: batches.map((data) => ({ data })),
    });
  });

  test("follows a cursor on an empty page and stops on an empty final page", async () => {
    const fire = vi
      .fn()
      .mockResolvedValueOnce({ items: [], paginationState: { cursor: "next" } })
      .mockResolvedValueOnce({ items: [] });
    const execution = vi.fn();
    const harness = createHarness(
      flow({
        ...base,
        batchConfig: { batchSize: 2 },
        trigger: batchFlowTrigger({ onTrigger: fire }),
        onExecution: execution,
      }),
    );

    expect(await harness.run()).toMatchObject({ status: "batched", pages: 2, results: [] });
    expect(execution).not.toHaveBeenCalled();
  });

  test("uses only the first page's polledNoChanges flag", async () => {
    const fire = vi
      .fn()
      .mockResolvedValueOnce({ items: [1], paginationState: { next: true } })
      .mockResolvedValueOnce({ items: [2], polledNoChanges: true });
    const execution = vi.fn(async () => ({ data: true }));
    const harness = createHarness(
      flow({
        ...base,
        batchConfig: { batchSize: 1 },
        trigger: batchFlowTrigger({ onTrigger: fire }),
        onExecution: execution,
      }),
    );

    expect((await harness.run()).results).toHaveLength(2);
    expect(execution).toHaveBeenCalledTimes(2);
  });

  test("mocks both imported discovery and standard component resolver callbacks", async ({
    callable: { calls, real },
  }) => {
    const harness = createHarness(
      flow({
        ...base,
        onTrigger: calls.triggers.batch(),
        onExecution: async (_context, params) => ({ data: params.onTrigger.results.body.data }),
      }),
    );
    harness.mock(calls.triggers.batch.perform).mockResolvedValue({ payload });
    const resolver = required(calls.triggers.batch.triggerResolver);
    harness
      .mock(required(resolver.resolveItems))
      .mockReturnValueOnce([1, 2, 3])
      .mockReturnValueOnce([4]);
    harness
      .mock(required(resolver.getNextPaginationState))
      .mockReturnValueOnce({ cursor: 2 })
      .mockReturnValueOnce(null);

    expect(await harness.run()).toMatchObject({
      status: "batched",
      pages: 2,
      results: [{ data: [1, 2] }, { data: [3] }, { data: [4] }],
    });

    expect(harness.mock(required(resolver.resolveItems))).toHaveBeenCalledTimes(2);
    expect(
      harness.mock(calls.triggers.batch.perform).mock.calls[0][0].paginationState,
    ).toBeUndefined();
    expect(harness.mock(calls.triggers.batch.perform).mock.calls[1][0].paginationState).toEqual({
      cursor: 2,
    });

    expect(real).not.toHaveBeenCalled();
  });

  test.for([
    "items",
    "cursor",
  ])("diagnoses missing %s mocks without invoking component code", async (missing, {
    callable: { calls, real },
  }) => {
    const execute = vi.fn();
    const harness = createHarness(
      flow({ ...base, onTrigger: calls.triggers.batch(), onExecution: execute }),
    );
    harness.mock(calls.triggers.batch.perform).mockResolvedValue({ payload });
    if (missing === "cursor")
      harness
        .mock(required(required(calls.triggers.batch.triggerResolver).resolveItems))
        .mockReturnValue([1]);
    await expect(harness.run()).rejects.toThrow(
      missing === "items"
        ? "resolveItems must return an array"
        : "getNextPaginationState must return an object or null",
    );

    expect(execute).not.toHaveBeenCalled();
    expect(real).not.toHaveBeenCalled();
  });

  test("runs CNI initial sync independently from normal discovery and deployment", async () => {
    const regular = vi.fn(async () => ({ items: ["regular"] }));
    const deploy = vi.fn();
    const harness = createHarness(
      flow({
        ...base,
        batchConfig: { batchSize: 1 },
        onInstanceDeploy: deploy,
        trigger: batchFlowTrigger<string>({
          onTrigger: regular,
          onDeploy: async () => ({ items: ["initial"] }),
        }),
        onExecution: async (_context, params) => ({ data: params.onTrigger.results.body.data }),
      }),
    );

    expect((await harness.initialSync()).results).toEqual([{ data: "initial" }]);
    expect(regular).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();
    expect((await harness.run()).results).toEqual([{ data: "regular" }]);
  });

  test("mocks imported initial-sync perform and resolvers", async ({
    callable: { calls, real },
  }) => {
    const harness = createHarness(
      flow({
        ...base,
        onTrigger: calls.triggers.batch(),
        onExecution: async (_context, params) => ({ data: params.onTrigger.results.body.data }),
      }),
    );
    harness.mock(required(calls.triggers.batch.onDeployPerform)).mockResolvedValue({ payload });
    harness
      .mock(required(required(calls.triggers.batch.onDeployResolver).resolveItems))
      .mockReturnValue(["initial"]);
    harness
      .mock(required(required(calls.triggers.batch.onDeployResolver).getNextPaginationState))
      .mockReturnValue(null);

    expect((await harness.initialSync()).results).toEqual([{ data: ["initial"] }]);
    expect(harness.mock(calls.triggers.batch.perform)).not.toHaveBeenCalled();
    expect(real).not.toHaveBeenCalled();
  });

  test("stops endless discovery at the configured page limit", async () => {
    const fire = vi.fn(async () => ({ items: [], paginationState: { same: true } }));
    const harness = createHarness(
      flow({
        ...base,
        batchConfig: { batchSize: 1 },
        trigger: batchFlowTrigger({ onTrigger: fire }),
        onExecution: async () => ({ data: null }),
      }),
    );

    await expect(harness.run({ maxPages: 3 })).rejects.toThrow("exceeded maxPages (3)");

    expect(fire).toHaveBeenCalledTimes(3);
  });

  test("caps concurrent workers while preserving input order after out-of-order completion", async ({
    work,
  }) => {
    const started = Array.from({ length: 4 }, work.gate);
    const finish = Array.from({ length: 4 }, work.gate);
    const completed: number[] = [];
    let active = 0;
    let peak = 0;
    const harness = createHarness(
      flow({
        ...base,
        batchConfig: { batchSize: 1, concurrentBatchLimit: 2 },
        trigger: batchFlowTrigger<number>({ onTrigger: async () => ({ items: [1, 2, 3, 4] }) }),
        onExecution: async (context, params) => {
          const item = params.onTrigger.results.body.data as number;

          expect(context.executionState).toEqual({});
          context.executionState.item = item;
          peak = Math.max(peak, ++active);
          started[item - 1].release();
          await finish[item - 1].promise;
          completed.push(item);
          active--;

          return { data: item };
        },
      }),
    );

    const run = work.track(harness.run({ concurrency: 4 }));
    await waitFor(Promise.all([started[0].promise, started[1].promise]), run);

    expect(active).toBe(2);
    finish[1].release();
    await waitFor(started[2].promise, run);
    finish[2].release();
    await waitFor(started[3].promise, run);
    finish[3].release();
    finish[0].release();

    expect((await run).results).toEqual([1, 2, 3, 4].map((data) => ({ data })));
    expect(completed).toEqual([2, 3, 4, 1]);
    expect(peak).toBe(2);
  });

  test("drains in-flight batches after failure and stops further work", async ({ work }) => {
    const started = work.gate();
    const finish = work.gate();
    const seen: number[] = [];
    let settled = false;
    const harness = createHarness(
      flow({
        ...base,
        batchConfig: { batchSize: 1 },
        trigger: batchFlowTrigger<number>({ onTrigger: async () => ({ items: [1, 2, 3, 4] }) }),
        onExecution: async (_context, params) => {
          const item = params.onTrigger.results.body.data as number;
          if (item === 1) throw new Error("failed batch");
          started.release();
          await finish.promise;
          seen.push(item);

          return { data: item };
        },
      }),
    );

    const run = work.track(harness.run({ concurrency: 2 }));
    const recordSettlement = () => {
      settled = true;
    };
    const observed = run.then(recordSettlement, recordSettlement);

    await waitFor(started.promise, run);

    // Drain promise reactions while the second execution is explicitly blocked.
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(settled).toBe(false);
    finish.release();
    await observed;

    await expect(run).rejects.toThrow("failed batch");

    expect(seen).toEqual([2]);
  });

  test("rejects invalid limits and missing initial-sync definitions", async () => {
    const harness = createHarness(flow({ ...base, onExecution: async () => ({ data: null }) }));
    await expect(harness.run({ maxPages: 0 })).rejects.toThrow("positive safe integer");
    await expect(harness.run({ concurrency: -1 })).rejects.toThrow("positive safe integer");
    await expect(harness.initialSync()).rejects.toThrow("no initial-sync trigger");
  });

  test("never runs custom component resolvers, even when original callbacks throw", async () => {
    const forbidden = vi.fn((): never => {
      throw new Error("Original resolver executed");
    });

    const calls = callableComponent(
      component({
        key: "custom-batch",
        display,
        triggers: {
          custom: trigger({
            display,
            inputs: {},
            scheduleSupport: "valid",
            synchronousResponseSupport: "invalid",
            triggerResolverSupport: "required",
            batchConfig: { batchSize: 1 },
            perform: forbidden,
            triggerResolver: { resolveItems: forbidden, getNextPaginationState: forbidden },
          }),
        },
      }),
    );

    const harness = createHarness(
      flow({
        ...base,
        onTrigger: calls.triggers.custom(),
        onExecution: async (_context, params) => ({ data: params.onTrigger.results.body.data }),
      }),
    );
    harness.mock(calls.triggers.custom.perform).mockResolvedValue({ payload });
    const resolver = required(calls.triggers.custom.triggerResolver);
    harness.mock(required(resolver.resolveItems)).mockReturnValue(["mocked"]);
    harness.mock(required(resolver.getNextPaginationState)).mockReturnValue(null);

    expect((await harness.run()).results).toEqual([{ data: "mocked" }]);
    expect(forbidden).not.toHaveBeenCalled();
  });

  test("short-circuits the first batch page without needing resolver mocks", async ({
    callable: { calls, real },
  }) => {
    const execution = vi.fn();
    const harness = createHarness(
      flow({ ...base, onTrigger: calls.triggers.batch(), onExecution: execution }),
    );
    harness
      .mock(calls.triggers.batch.perform)
      .mockResolvedValue({ payload, polledNoChanges: true });

    expect(await harness.run()).toMatchObject({ status: "skipped", pages: 1, results: [] });
    expect(execution).not.toHaveBeenCalled();
    expect(
      harness.mock(required(required(calls.triggers.batch.triggerResolver).resolveItems)),
    ).not.toHaveBeenCalled();
    expect(real).not.toHaveBeenCalled();
  });

  test("keeps batch payloads and caller payloads independent", async () => {
    const original = {
      ...payload,
      headers: { unchanged: "yes" },
      rawBody: { data: Buffer.from([1]) },
    };
    const item = Buffer.from([4]);
    const harness = createHarness(
      flow({
        ...base,
        batchConfig: { batchSize: 1 },
        trigger: batchFlowTrigger<Buffer>({
          onTrigger: async (_context, incoming) => {
            assert(Buffer.isBuffer(incoming.rawBody.data));
            incoming.rawBody.data[0] = 2;

            return { items: [item, item] };
          },
        }),
        onExecution: async (_context, params) => {
          expect(params.onTrigger.results.headers.unchanged).toBe("yes");
          params.onTrigger.results.headers.unchanged = "mutated";
          const { rawBody, body } = params.onTrigger.results;
          assert(Buffer.isBuffer(rawBody.data));
          assert(Buffer.isBuffer(body.data));
          expect(rawBody.data[0]).toBe(2);
          expect(body.data[0]).toBe(4);
          rawBody.data[0] = 3;
          body.data[0] = 5;

          return { data: null };
        },
      }),
    );

    await harness.run({ payload: original });

    expect(original.headers.unchanged).toBe("yes");
    expect(original.rawBody.data[0]).toBe(1);
    expect(item[0]).toBe(4);
  });

  test("shares explicit instance state with initial sync, polling, and lifecycle callbacks", async () => {
    const state: Record<string, unknown> = {};
    const harness = createHarness(
      flow({
        ...base,
        batchConfig: { batchSize: 1 },
        onInstanceDeploy: async (context) => {
          context.instanceState.deployed = true;
        },
        trigger: batchFlowTrigger<string>({
          onDeploy: async (context) => {
            context.polling.setState({ synced: true });

            return { items: [] };
          },
          onTrigger: async (context) => ({ items: [String(context.polling.getState().synced)] }),
        }),
        onExecution: async (_context, params) => ({ data: params.onTrigger.results.body.data }),
      }),
    );

    await harness.onInstanceDeploy();

    expect(harness.instanceState.deployed).toBe(true);
    await harness.initialSync({ context: { instanceState: state } });

    expect((await harness.run({ context: { instanceState: state } })).results).toEqual([
      { data: "true" },
    ]);
    expect((await harness.run()).results).toEqual([{ data: "undefined" }]);
  });

  test("supports non-batch initial-sync triggers without invoking the normal trigger", async () => {
    const regular = vi.fn(async () => ({ payload }));
    const harness = createHarness(
      flow({
        ...base,
        onTrigger: regular,
        onDeployTrigger: async () => ({ payload: { ...payload, body: { data: "initial" } } }),
        onExecution: async (_context, params) => ({ data: params.onTrigger.results.body.data }),
      }),
    );

    expect(await harness.initialSync()).toMatchObject({
      status: "completed",
      result: { data: "initial" },
    });

    expect(regular).not.toHaveBeenCalled();
  });
});
