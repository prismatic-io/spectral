import { describe, expect, it, vi } from "vitest";
import { batchFlowTrigger, flow, integration } from "..";
import type { ActionContext, ComponentRegistry, TriggerPayload, TriggerResult } from "../types";
import { requireContext, runWithContext } from "./asyncContext";
import { createCNIPerform, createCNIPollingPerform } from "./perform";

const contextFor = (executionId: string) =>
  ({
    executionId,
    instanceState: {},
    configVars: {},
    globalDebug: false,
  }) as unknown as ActionContext;

const payload = {} as TriggerPayload;

// Converted callbacks accept the runner context; their wrappers add polling helpers.
// The component type also includes author-facing polling signatures.
type RunnerTrigger = (
  context: ActionContext,
  payload: TriggerPayload,
  params: Record<string, unknown>,
) => Promise<TriggerResult<boolean, TriggerPayload>>;

// This is the call pattern emitted by the existing component-manifest action template.
const manifestAction = {
  inputs: { label: { inputType: "string" as const } },
  perform: async (values: { label: string }) => {
    const context = requireContext();

    return context.components.fixture.echo(values);
  },
};

const componentRegistry: ComponentRegistry = {
  fixture: {
    key: "fixture",
    public: false,
    signature: "fixture-signature",
    actions: { echo: manifestAction },
    triggers: {},
    dataSources: {},
    connections: {},
  },
};

// The runner deliberately makes invocation capabilities non-enumerable.
const contextWithInvoker = (executionId: string, invoke: unknown): ActionContext =>
  Object.defineProperty(contextFor(executionId), "_components", {
    value: { invoke },
    enumerable: false,
    configurable: false,
    writable: false,
  });

describe("CNI trigger execution context", () => {
  it.each([
    "standard",
    "polling",
  ] as const)("lets existing manifest helpers run in concurrent %s triggers", async (kind) => {
    const invoke = vi.fn(async (_ref: unknown, context: ActionContext, values: unknown) => ({
      data: { executionId: context.executionId, values },
    }));

    const onTrigger = async (context: ActionContext, receivedPayload: TriggerPayload) => {
      await Promise.resolve();
      expect(requireContext()).toBe(context);
      return {
        payload: receivedPayload,
        instanceState: { result: await manifestAction.perform({ label: context.executionId }) },
      };
    };

    const perform =
      kind === "standard"
        ? createCNIPerform({ componentRegistry, onTrigger })
        : createCNIPollingPerform({ componentRegistry, onTrigger });

    const results = await Promise.all(
      ["first", "second"].map((executionId) => {
        const context = contextWithInvoker(executionId, invoke);
        return perform(context, payload, {});
      }),
    );

    expect(results.map((result) => result?.instanceState)).toEqual(
      ["first", "second"].map((executionId) => ({
        result: { data: { executionId, values: { label: executionId } } },
      })),
    );

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(() => requireContext()).toThrow("ActionContext not found");
  });

  it("binds the complete polling context and preserves polling results", async () => {
    const perform = createCNIPollingPerform({
      componentRegistry: {},
      onTrigger: async (context, receivedPayload) => {
        await Promise.resolve();
        expect(requireContext()).toBe(context);
        context.polling.setState({ cursor: "next" });
        return { payload: receivedPayload, polledNoChanges: true };
      },
    });
    const context = contextFor("poll");

    const result = await perform(context, payload, {});

    expect(result?.resultType).toBe("polled_no_changes");
    expect(context.instanceState).toEqual({ __prismaticInternal: { polling: { cursor: "next" } } });
  });

  it("binds enriched batch contexts for regular and initial-sync fires and restores the caller", async () => {
    const checkContext = async (context: ActionContext) => {
      await Promise.resolve();
      expect(requireContext()).toBe(context);
      return manifestAction.perform({ label: context.executionId });
    };

    const cni = integration({
      name: "Batched manifest calls",
      componentRegistry,
      flows: [
        flow({
          name: "Batch",
          stableKey: "batch-context",
          batchConfig: { batchSize: 1 },
          trigger: batchFlowTrigger({
            onTrigger: async (context) => {
              const result = await checkContext(context);
              context.polling.setState({ fire: "regular" });
              return { items: [result] };
            },
            onDeploy: async (context) => {
              await checkContext(context);
              context.polling.setState({ fire: "deploy" });
              throw new Error("deploy failed");
            },
          }),
          onExecution: async () => ({ data: true }),
        }),
      ],
    });

    const trigger = Object.values(cni.triggers)[0];
    const invoke = vi.fn(async () => ({ data: "manifest result" }));
    const context = contextWithInvoker("batch", invoke);
    const caller = contextFor("caller");

    await runWithContext(caller, async () => {
      await expect((trigger.perform as RunnerTrigger)(context, payload, {})).resolves.toMatchObject(
        {
          payload: { body: { data: [{ data: "manifest result" }] } },
        },
      );
      expect(requireContext()).toBe(caller);
      expect(context.instanceState).toEqual({
        __prismaticInternal: { polling: { fire: "regular" } },
      });

      await expect(
        (trigger.onDeployPerform as RunnerTrigger)(context, payload, {}),
      ).rejects.toThrow("deploy failed");
      expect(requireContext()).toBe(caller);
      expect(context.instanceState).toEqual({
        __prismaticInternal: { polling: { fire: "deploy" } },
      });
    });

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(() => requireContext()).toThrow("ActionContext not found");
  });

  it.each([
    ["standard", "synchronous"],
    ["standard", "asynchronous"],
    ["polling", "synchronous"],
    ["polling", "asynchronous"],
  ] as const)("restores a nested caller after a %s trigger's %s failure", async (kind, failure) => {
    const error = new Error("trigger failed");
    const onTrigger = (context: ActionContext): Promise<never> => {
      expect(requireContext()).toBe(context);

      if (failure === "synchronous") {
        throw error;
      }

      return Promise.resolve().then(() => {
        expect(requireContext()).toBe(context);
        throw error;
      });
    };
    const perform =
      kind === "standard"
        ? createCNIPerform({ componentRegistry, onTrigger })
        : createCNIPollingPerform({ componentRegistry, onTrigger });
    const caller = contextFor("caller");

    await runWithContext(caller, async () => {
      await expect(perform(contextFor("nested"), payload, {})).rejects.toBe(error);
      expect(requireContext()).toBe(caller);
    });

    expect(() => requireContext()).toThrow("ActionContext not found");
  });

  it.each([
    "perform",
    "onDeployPerform",
  ] as const)("isolates concurrent batch %s fires and preserves their results", async (entry) => {
    const fire = async (context: ActionContext) => {
      await Promise.resolve();
      expect(requireContext()).toBe(context);
      const result = await manifestAction.perform({ label: context.executionId });

      return { items: [result], paginationState: { cursor: context.executionId } };
    };
    const cni = integration({
      name: "Concurrent batch fires",
      componentRegistry,
      flows: [
        flow({
          name: "Batch",
          stableKey: "batch",
          batchConfig: { batchSize: 1 },
          trigger: batchFlowTrigger({ onTrigger: fire, onDeploy: fire }),
          onExecution: async () => ({ data: true }),
        }),
      ],
    });
    const callback = Object.values(cni.triggers)[0][entry] as RunnerTrigger;
    const invoke = vi.fn(async (_ref: unknown, context: ActionContext) => ({
      data: context.executionId,
    }));
    const ids = ["first", "second"];

    expect(callback).toBeTypeOf("function");
    const results = await Promise.all(
      ids.map((id) => callback?.(contextWithInvoker(id, invoke), payload, {})),
    );

    expect(results.map((result) => result?.payload)).toEqual(
      ids.map((id) => ({
        body: { data: [{ data: id }], contentType: "application/json" },
        paginationState: { cursor: id },
      })),
    );
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(() => requireContext()).toThrow("ActionContext not found");
  });
});
