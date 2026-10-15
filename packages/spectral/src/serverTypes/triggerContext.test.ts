import { describe, expect, it, vi } from "vitest";
import { batchFlowTrigger, flow, integration } from "..";
import type { ActionContext, ComponentRegistry, TriggerPayload } from "../types";
import { requireContext, runWithContext } from "./asyncContext";
import { createCNIPerform, createCNIPollingPerform } from "./perform";

const contextFor = (executionId: string) =>
  ({ executionId, instanceState: {}, configVars: {}, globalDebug: false }) as ActionContext;
const payload = {} as TriggerPayload;

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
        const context = { ...contextFor(executionId), _components: { invoke } };
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
    const context = { ...contextFor("batch"), _components: { invoke } };
    const caller = contextFor("caller");
    await runWithContext(caller, async () => {
      await expect(trigger.perform(context, payload, {})).resolves.toMatchObject({
        payload: { body: { data: [{ data: "manifest result" }] } },
      });
      expect(requireContext()).toBe(caller);
      expect(context.instanceState).toEqual({
        __prismaticInternal: { polling: { fire: "regular" } },
      });
      await expect(trigger.onDeployPerform?.(context, payload, {})).rejects.toThrow(
        "deploy failed",
      );
      expect(requireContext()).toBe(caller);
      expect(context.instanceState).toEqual({
        __prismaticInternal: { polling: { fire: "deploy" } },
      });
    });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(() => requireContext()).toThrow("ActionContext not found");
  });
});
