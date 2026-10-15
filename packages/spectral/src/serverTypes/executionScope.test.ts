import { describe, expect, it } from "vitest";
import {
  action,
  batchTrigger,
  component,
  dataSource,
  flow,
  integration,
  pollingTrigger,
  trigger,
} from "..";
import type { ActionContext, ComponentRegistry, TriggerPayload, TriggerResult } from "../types";
import type { Component } from ".";
import { requireContext, runWithContext } from "./asyncContext";

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
const display = {
  label: "Scope",
  description: "Execution scope contract",
  iconPath: "icon.png",
  category: "Helpers",
};

type CallbackKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends (...args: never[]) => unknown ? K : never;
}[keyof T];

// Adding a runtime callback requires an explicit scope test here.
const triggerCallbacks = {
  perform: "perform",
  onDeployPerform: "perform",
  onInstanceDeploy: "event",
  onInstanceDelete: "event",
  webhookCreate: "event",
  webhookDelete: "event",
  resolveTriggerItems: "resolver",
  getNextPaginationState: "resolver",
  resolveOnDeployItems: "resolver",
  getOnDeployNextPaginationState: "resolver",
} as const satisfies Record<CallbackKeys<Component["triggers"][string]>, string>;

describe("conventional component execution scope", () => {
  const check = async () => {
    expect(() => requireContext()).toThrow("ActionContext not found");
    await Promise.resolve();
    expect(() => requireContext()).toThrow("ActionContext not found");
  };

  const perform = async (_context: ActionContext, received: TriggerPayload) => {
    await check();
    return { payload: received };
  };

  const event = async () => {
    await check();
    return {};
  };

  const resolver = () => {
    expect(() => requireContext()).toThrow("ActionContext not found");
    return [];
  };

  const pagination = () => {
    expect(() => requireContext()).toThrow("ActionContext not found");
    return null;
  };

  const definition = component({
    key: "scope",
    display,
    actions: {
      action: action({
        display,
        inputs: {},
        perform: async () => {
          await check();
          return { data: true };
        },
      }),
    },
    dataSources: {
      choices: dataSource({
        display,
        inputs: {},
        dataSourceType: "picklist",
        perform: async () => {
          await check();
          return { result: [] };
        },
      }),
    },
    triggers: {
      regular: trigger({
        display,
        scheduleSupport: "valid",
        synchronousResponseSupport: "valid",
        triggerResolverSupport: "valid",
        inputs: {},
        batchConfig: { batchSize: 1 },
        perform,
        onInstanceDeploy: event,
        onInstanceDelete: event,
        webhookLifecycleHandlers: { create: event, delete: event },
        onDeployPerform: perform,
        triggerResolver: { resolveItems: resolver, getNextPaginationState: pagination },
        onDeployResolver: { resolveItems: resolver, getNextPaginationState: pagination },
      }),
      poll: pollingTrigger({ display, inputs: {}, perform }),
      batch: batchTrigger({
        display,
        scheduleSupport: "valid",
        inputs: {},
        batchConfig: { batchSize: 1 },
        perform: async (context) => {
          await check();
          context.polling.setState({ regular: true });
          return { items: [] };
        },
        onDeploy: {
          perform: async (context) => {
            await check();
            context.polling.setState({ deploy: true });
            return { items: [] };
          },
        },
      }),
    },
  });

  it.each(Object.entries(triggerCallbacks))("does not establish ALS for %s", async (key, kind) => {
    const callback = definition.triggers.regular[key as keyof typeof triggerCallbacks];
    expect(callback).toBeTypeOf("function");

    // The runtime has three signatures; the table specifies which wire arguments to use.
    await (callback as (...args: unknown[]) => unknown)(
      contextFor(key),
      kind === "resolver" ? { payload } : kind === "event" ? {} : payload,
      {},
    );
  });

  it("keeps actions and data sources outside execution scope", async () => {
    await definition.actions.action.perform(contextFor("action"), {});
    await definition.dataSources.choices.perform(contextFor("dataSource"), {});
  });

  it("keeps polling and both batch fires outside execution scope", async () => {
    const context = contextFor("batch");
    await (definition.triggers.poll.perform as RunnerTrigger)(context, payload, {});
    await (definition.triggers.batch.perform as RunnerTrigger)(context, payload, {});
    await (definition.triggers.batch.onDeployPerform as RunnerTrigger)(context, payload, {});

    expect(context.instanceState).toEqual({ __prismaticInternal: { polling: { deploy: true } } });
  });
});

describe("converted CNI callback execution scope", () => {
  it.each([
    "onExecution",
    "onInstanceDeploy",
    "onInstanceDelete",
    "webhookCreate",
    "webhookDelete",
  ] as const)("isolates concurrent %s callbacks and restores the caller after failures", async (entry) => {
    const check = async (context: ActionContext) => {
      expect(requireContext()).toBe(context);
      await Promise.resolve();
      expect(requireContext()).toBe(context);

      if (context.executionId === "fail") {
        throw new Error("callback failed");
      }

      return { data: context.executionId };
    };

    const event = async (context: ActionContext) => ({ instanceState: await check(context) });

    const cni = integration({
      name: "Execution scope",
      flows: [
        flow({
          name: "Scope",
          stableKey: "scope",
          onTrigger: async (_context, received) => ({ payload: received }),
          onExecution: check,
          onInstanceDeploy: event,
          onInstanceDelete: event,
          webhookLifecycleHandlers: { create: event, delete: event },
        }),
      ],
    });

    const converted = Object.values(cni.triggers)[0];
    const callback =
      entry === "onExecution" ? Object.values(cni.actions)[0].perform : converted[entry];
    expect(callback).toBeTypeOf("function");

    const caller = contextFor("caller");

    await runWithContext(caller, async () => {
      const results = await Promise.allSettled(
        ["first", "second", "fail"].map((id) => callback?.(contextFor(id), {})),
      );

      expect(results.map((result) => result.status)).toEqual([
        "fulfilled",
        "fulfilled",
        "rejected",
      ]);
      expect(results[2]).toMatchObject({ reason: new Error("callback failed") });
      expect(requireContext()).toBe(caller);
    });

    expect(() => requireContext()).toThrow("ActionContext not found");
  });
});

describe("CNI lifecycle callbacks wrapping a referenced trigger", () => {
  it.each([
    "onInstanceDeploy",
    "onInstanceDelete",
    "webhookCreate",
    "webhookDelete",
  ] as const)("preserves %s ordering, merge precedence, and scope through failures", async (entry) => {
    const calls: string[] = [];
    const receivedContexts = new Map<string, ActionContext>();
    const params = { marker: "lifecycle inputs" };
    const referenceError = new Error("referenced lifecycle failed");
    const customError = new Error("custom lifecycle failed");
    const componentRegistry: ComponentRegistry = {
      fixture: {
        key: "fixture",
        public: false,
        signature: "fixture-signature",
        actions: {},
        triggers: { event: { inputs: {}, perform: async () => ({}) } },
        dataSources: {},
        connections: {},
      },
    };

    const custom = async (context: ActionContext, receivedParams: unknown) => {
      expect(receivedParams).toBe(params);
      expect(context).toBe(receivedContexts.get(context.executionId));
      expect(requireContext()).toBe(context);
      calls.push(`${context.executionId}:custom`);

      await Promise.resolve();

      expect(requireContext()).toBe(context);
      if (context.executionId === "custom-failure") {
        throw customError;
      }

      return { instanceState: { shared: { winner: "custom", customOnly: true } } };
    };

    const cni = integration({
      name: "Referenced lifecycle scope",
      componentRegistry,
      flows: [
        flow({
          name: "Reference",
          stableKey: "reference",
          onTrigger: { component: "fixture", key: "event", values: {} },
          onExecution: async () => ({ data: true }),
          onInstanceDeploy: custom,
          onInstanceDelete: custom,
          webhookLifecycleHandlers: { create: custom, delete: custom },
        }),
      ],
    });
    const callback = Object.values(cni.triggers)[0][entry];
    expect(callback).toBeTypeOf("function");

    const context = (executionId: string) =>
      Object.defineProperty(contextFor(executionId), "_components", {
        value: {
          invokeTrigger: async (
            ref: unknown,
            context: ActionContext,
            receivedPayload: unknown,
            receivedParams: unknown,
          ) => {
            expect(ref).toEqual({
              component: { key: "fixture", signature: "fixture-signature", isPublic: false },
              key: "event",
              triggerEventFunctionName: entry,
            });
            expect(receivedPayload).toBeNull();
            expect(receivedParams).toBe(params);
            expect(requireContext()).toBe(context);
            receivedContexts.set(executionId, context);
            calls.push(`${executionId}:reference`);

            await Promise.resolve();

            expect(requireContext()).toBe(context);
            if (executionId === "reference-failure") {
              throw referenceError;
            }

            return { instanceState: { shared: { winner: "reference", referenceOnly: true } } };
          },
        },
        enumerable: false,
        configurable: false,
        writable: false,
      });

    const caller = contextFor("caller");

    await runWithContext(caller, async () => {
      await expect(callback?.(context("success"), params)).resolves.toEqual({
        instanceState: {
          shared: { winner: "custom", referenceOnly: true, customOnly: true },
        },
      });
      expect(requireContext()).toBe(caller);

      await expect(callback?.(context("reference-failure"), params)).rejects.toBe(referenceError);
      expect(requireContext()).toBe(caller);

      await expect(callback?.(context("custom-failure"), params)).rejects.toBe(customError);
      expect(requireContext()).toBe(caller);
    });

    expect(calls).toEqual([
      "success:reference",
      "success:custom",
      "reference-failure:reference",
      "custom-failure:reference",
      "custom-failure:custom",
    ]);
    expect(() => requireContext()).toThrow("ActionContext not found");
  });
});

describe("conventional calls nested inside CNI", () => {
  it("preserves the caller's scope without binding the component's context", async () => {
    const caller = contextFor("cni");
    const callee = contextFor("component");
    const definition = component({
      key: "nested",
      display,
      actions: {
        nested: action({
          display,
          inputs: {},
          perform: async (context) => {
            expect(context.executionId).toBe(callee.executionId);
            expect(requireContext()).toBe(caller);

            await Promise.resolve();

            expect(requireContext()).toBe(caller);
            throw new Error("component failed");
          },
        }),
      },
    });

    await runWithContext(caller, async () => {
      await expect(definition.actions.nested.perform(callee, {})).rejects.toThrow(
        "component failed",
      );
      expect(requireContext()).toBe(caller);
    });

    expect(() => requireContext()).toThrow("ActionContext not found");
  });
});
