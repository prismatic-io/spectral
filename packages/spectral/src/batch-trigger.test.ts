import { describe, expect, it } from "vitest";
import { batchFlowTrigger, batchTrigger, component, input, type TriggerPayload } from ".";
import { convertTrigger } from "./serverTypes/convertComponent";
import { defaultTriggerPayload, invokeTrigger } from "./testing";
import type { ActionContext } from "./types";

type Order = { id: number };
type Cursor = { page: number };

const context = {} as ActionContext;

const payload = (paginationState?: Cursor): TriggerPayload => ({
  ...defaultTriggerPayload(),
  ...(paginationState ? { paginationState } : {}),
});

const pages: Order[][] = [[{ id: 1 }, { id: 2 }], [{ id: 3 }]];

const syncOrders = batchTrigger({
  display: { label: "Sync Orders", description: "Fetches every order" },
  inputs: { connection: input({ label: "Connection", type: "connection", required: true }) },
  scheduleSupport: "required",
  batchConfig: { batchSize: 2, concurrentBatchLimit: 3 },
  perform: async (_context, payload: TriggerPayload<Cursor>, _params) => {
    const page = payload.paginationState?.page ?? 0;
    return {
      items: pages[page],
      paginationState: page + 1 < pages.length ? { page: page + 1 } : null,
    };
  },
  onDeploy: {
    inputs: { backfillStart: input({ label: "Backfill start", type: "string" }) },
    perform: async (_context, _payload, params) => ({
      items: [{ id: Number(params.backfillStart) }],
    }),
  },
});

describe("batchTrigger", () => {
  it("fixes triggerResolverSupport to 'required' and synchronousResponseSupport to 'invalid'", () => {
    expect(syncOrders.triggerResolverSupport).toBe("required");
    expect(syncOrders.synchronousResponseSupport).toBe("invalid");
    expect(syncOrders.scheduleSupport).toBe("required");
    expect(syncOrders.batchConfig).toEqual({ batchSize: 2, concurrentBatchLimit: 3 });
  });

  it("emits the page's items at body.data and its cursor at paginationState", async () => {
    const { result } = await invokeTrigger(syncOrders, undefined, payload(), {
      connection: {} as never,
    });
    expect(result?.payload.body).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      contentType: "application/json",
    });
    expect(result?.payload.paginationState).toEqual({ page: 1 });
  });

  it("writes a null paginationState on the last page", async () => {
    const { result } = await invokeTrigger(syncOrders, undefined, payload({ page: 1 }), {
      connection: {} as never,
    });
    expect(result?.payload.body.data).toEqual([{ id: 3 }]);
    expect(result?.payload.paginationState).toBeNull();
  });

  it("gives the perform context.polling backed by the instance state", async () => {
    const watermark = batchTrigger({
      display: { label: "Watermark", description: "Polls since the last run" },
      inputs: {},
      scheduleSupport: "required",
      batchConfig: { batchSize: 1 },
      perform: async (context) => {
        const { since } = context.polling.getState();
        context.polling.setState({ since: "2026-02-01" });
        return { items: [since] };
      },
      onDeploy: {
        perform: async (context) => {
          context.polling.setState({ since: "backfilled" });
          return { items: [] };
        },
      },
    });
    const instanceState: Record<string, unknown> = {
      __prismaticInternal: { polling: { since: "2026-01-01" } },
    };

    const { result } = await invokeTrigger(watermark, { instanceState }, payload());

    expect(result?.payload.body.data).toEqual(["2026-01-01"]);
    expect(instanceState.__prismaticInternal).toEqual({ polling: { since: "2026-02-01" } });

    await watermark.onDeployPerform?.({ instanceState } as ActionContext, payload(), {});
    expect(instanceState.__prismaticInternal).toEqual({ polling: { since: "backfilled" } });
  });

  it("synthesizes a resolver that reads the items and cursor back from the wrapped result", async () => {
    const { result } = await invokeTrigger(syncOrders, undefined, payload(), {
      connection: {} as never,
    });
    const resolver = syncOrders.triggerResolver;
    expect(resolver?.resolveItems?.(context, result as never)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(resolver?.getNextPaginationState?.(context, result as never)).toEqual({ page: 1 });
  });

  it("forwards response and branch from the fire onto the trigger result", async () => {
    const branching = batchTrigger({
      display: { label: "Files", description: "" },
      inputs: {},
      scheduleSupport: "required",
      allowsBranching: true,
      staticBranchNames: ["csv", "json"],
      batchConfig: { batchSize: 1 },
      perform: async () => ({
        items: ["a.csv"],
        branch: "csv",
        response: { statusCode: 202, contentType: "text/plain", body: "queued" },
      }),
    });
    const { result } = await invokeTrigger(branching, undefined, payload(), {});
    expect(result?.branch).toBe("csv");
    expect(result?.response).toEqual({
      statusCode: 202,
      contentType: "text/plain",
      body: "queued",
    });
  });

  it("maps onDeploy to onDeployPerform plus an onDeployResolver carrying the on-deploy inputs", async () => {
    expect(syncOrders.onDeployPerform).toBeTypeOf("function");
    expect(Object.keys(syncOrders.onDeployResolver?.inputs ?? {})).toEqual(["backfillStart"]);
    const result = await syncOrders.onDeployPerform?.(context, payload(), {
      connection: {} as never,
      backfillStart: "42",
    });
    expect(result?.payload.body.data).toEqual([{ id: 42 }]);
    expect(result?.payload.paginationState).toBeNull();
    expect(syncOrders.onDeployResolver?.resolveItems?.(context, result as never)).toEqual([
      { id: 42 },
    ]);
  });

  it("types the on-deploy cursor independently of the perform's cursor", async () => {
    const webhookWithBackfill = batchTrigger({
      display: { label: "Webhook + backfill", description: "" },
      inputs: {},
      scheduleSupport: "invalid",
      batchConfig: { batchSize: 10 },
      perform: async (_context, payload) => ({ items: [payload.body.data] }),
      onDeploy: {
        perform: async (_context, payload: TriggerPayload<{ offset: number }>) => {
          const offset: number = payload.paginationState?.offset ?? 0;
          return { items: [offset], paginationState: offset < 20 ? { offset: offset + 10 } : null };
        },
      },
    });
    const result = await webhookWithBackfill.onDeployPerform?.(
      context,
      { ...payload(), paginationState: { offset: 10 } } as never,
      {},
    );
    expect(result?.payload.body.data).toEqual([10]);
    expect(result?.payload.paginationState).toEqual({ offset: 20 });
  });

  it("accepts an interface as the cursor type", () => {
    interface PageCursor {
      page: number;
    }
    batchTrigger({
      display: { label: "x", description: "" },
      inputs: {},
      scheduleSupport: "required",
      batchConfig: { batchSize: 1 },
      perform: async (_context, payload: TriggerPayload<PageCursor>) => ({
        items: [payload.paginationState?.page ?? 1],
        paginationState: null,
      }),
    });
    batchFlowTrigger<number, PageCursor>({
      onTrigger: async (_context, payload) => ({
        items: [payload.paginationState?.page ?? 1],
        paginationState: null,
      }),
    });
  });

  it("omits the on-deploy fields when onDeploy is not defined", () => {
    const plain = batchTrigger({
      display: { label: "Plain", description: "" },
      inputs: {},
      scheduleSupport: "required",
      batchConfig: { batchSize: 10 },
      perform: async () => ({ items: [1, 2, 3] }),
    });
    expect(plain.onDeployPerform).toBeUndefined();
    expect(plain.onDeployResolver).toBeUndefined();
    expect("onDeploy" in plain).toBe(false);
  });

  it("converts to the required-batching wire shape with on-deploy inputs scoped ON_DEPLOY", () => {
    const wire = convertTrigger("syncOrders", syncOrders);
    expect(wire.triggerResolverSupport).toBe("required");
    expect(wire.synchronousResponseSupport).toBe("invalid");
    expect(wire.triggerResolverDefaultBatchSize).toBe(2);
    expect(wire.triggerResolverDefaultConcurrentBatchLimit).toBe(3);
    expect(wire.hasResolveTriggerItems).toBe(true);
    expect(wire.hasGetNextDiscoveryState).toBe(true);
    expect(wire.hasOnDeployPerform).toBe(true);
    expect(wire.hasResolveOnDeployItems).toBe(true);
    expect(wire.hasGetOnDeployNextDiscoveryState).toBe(true);
    expect(wire.inputs.map(({ key, scope }) => ({ key, scope }))).toEqual([
      { key: "connection", scope: undefined },
      { key: "backfillStart", scope: "ON_DEPLOY" },
    ]);
    expect("onDeploy" in wire).toBe(false);
  });

  it("is accepted as a component trigger", () => {
    const definition = component({
      key: "orders",
      public: false,
      display: { label: "Orders", description: "", iconPath: "icon.png" },
      triggers: { syncOrders },
    });
    expect(definition.triggers?.syncOrders.triggerResolverSupport).toBe("required");
  });

  it("enforces the batched contract at author time", () => {
    batchTrigger({
      display: { label: "x", description: "" },
      inputs: {},
      scheduleSupport: "required",
      batchConfig: { batchSize: 1 },
      // @ts-expect-error - synchronous responses are fixed to "invalid"
      synchronousResponseSupport: "valid",
      perform: async () => ({ items: [] }),
    });
    batchTrigger({
      display: { label: "x", description: "" },
      inputs: {},
      scheduleSupport: "required",
      batchConfig: { batchSize: 1 },
      // @ts-expect-error - batching support is fixed to "required"
      triggerResolverSupport: "valid",
      perform: async () => ({ items: [] }),
    });
    // @ts-expect-error - a batched trigger must declare its default batch size
    batchTrigger({
      display: { label: "x", description: "" },
      inputs: {},
      scheduleSupport: "required",
      perform: async () => ({ items: [] }),
    });
    batchTrigger({
      display: { label: "x", description: "" },
      inputs: {},
      scheduleSupport: "required",
      batchConfig: { batchSize: 1 },
      allowsBranching: true,
      // @ts-expect-error - a branching batched trigger picks a branch per page
      perform: async () => ({ items: [] }),
    });
    batchTrigger({
      display: { label: "x", description: "" },
      inputs: {},
      scheduleSupport: "required",
      batchConfig: { batchSize: 1 },
      // @ts-expect-error - the returned cursor must match the annotated payload cursor type
      perform: async (_context, payload: TriggerPayload<Cursor>) => {
        const page: number = payload.paginationState?.page ?? 0;
        return { items: [page], paginationState: { cursor: "abc" } };
      },
    });
  });
});
