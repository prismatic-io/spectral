import { describe, expect, it, vi } from "vitest";
import {
  action,
  batchFlowTrigger,
  batchTrigger,
  callableComponent,
  component,
  configPage,
  connection,
  connectionConfigVar,
  dataSource,
  dataSourceConfigVar,
  flow,
  input,
  integration,
  pollingTrigger,
  trigger,
} from ".";
import { requireContext, runWithContext } from "./serverTypes/asyncContext";
import type { ActionContext, DataSourceContext, TriggerPayload } from "./types";

const display = { label: "Entities", description: "Callable entities" };
const payload = { body: { data: {}, contentType: "application/json" } } as TriggerPayload;
const contextFor = (executionId = "execution") =>
  ({ executionId, instanceState: {}, configVars: {}, logger: { info: () => {} } }) as ActionContext;
const parsedInput = (
  clean = vi.fn((value: unknown) => {
    if (typeof value !== "string") throw new Error("cleaned twice");
    return JSON.parse(value) as { value: string };
  }),
) => ({
  field: input({ type: "string", label: "Field", default: '{"value":"default"}', clean }),
  clean,
});

describe("callable component entities", () => {
  it("invokes a bundled data source from a config-page callback with configuration context", async () => {
    const { field, clean } = parsedInput();
    const contexts: DataSourceContext[] = [];
    const callable = callableComponent(
      component({
        key: "entities",
        display: { ...display, iconPath: "icon.png" },
        dataSources: {
          choices: dataSource({
            display,
            dataSourceType: "picklist",
            inputs: { query: field },
            perform: async (context, { query }) => {
              await Promise.resolve();
              contexts.push(context);
              expect(() => requireContext()).toThrow("unavailable during configuration");
              return { result: [`${context.configVars.label}:${query.value}`] };
            },
          }),
        },
      }),
    );
    const cni = integration({
      name: "Bundled data source",
      flows: [],
      configPages: {
        Configuration: configPage({
          elements: {
            choice: dataSourceConfigVar({
              stableKey: "choice",
              dataSourceType: "picklist",
              perform: async () => callable.dataSources.choices(),
            }),
          },
        }),
      },
    });
    const context = { ...contextFor(), configVars: { label: "configured" } };
    await expect(cni.dataSources.choice.perform(context, {})).resolves.toEqual({
      result: ["configured:default"],
    });
    expect(contexts).toEqual([context]);
    expect(contexts[0]).toBe(context);
    expect(clean).toHaveBeenCalledExactlyOnceWith('{"value":"default"}');
    await expect(callable.dataSources.choices()).rejects.toThrow("DataSourceContext not found");
  });

  it("cleans trigger and lifecycle inputs once while retaining payload, context, and state results", async () => {
    const { field, clean } = parsedInput();
    const context = contextFor();
    const event = vi.fn(async (receivedContext, params) => {
      expect(receivedContext).toBe(context);
      expect(requireContext()).toBe(receivedContext);
      return { instanceState: { received: params.query.value } };
    });
    const callable = callableComponent({
      triggers: {
        webhook: trigger({
          display,
          inputs: { query: field },
          scheduleSupport: "invalid",
          synchronousResponseSupport: "valid",
          perform: async (receivedContext, receivedPayload, params) => {
            expect(receivedContext).toBe(context);
            return { payload: receivedPayload, instanceState: { received: params.query.value } };
          },
          onInstanceDeploy: event,
          onInstanceDelete: event,
          webhookLifecycleHandlers: { create: event, delete: event },
        }),
      },
    });
    await runWithContext(context, async () => {
      const webhook = callable.triggers.webhook;
      const result = await webhook.perform(payload);
      expect(result.payload).toBe(payload);
      expect(result.instanceState).toEqual({ received: "default" });
      for (const invoke of [
        webhook.onInstanceDeploy,
        webhook.onInstanceDelete,
        webhook.webhookLifecycleHandlers?.create,
        webhook.webhookLifecycleHandlers?.delete,
      ]) {
        expect(await invoke?.({ query: '{"value":"event"}' })).toEqual({
          instanceState: { received: "event" },
        });
      }
    });
    expect(event).toHaveBeenCalledTimes(4);
    expect(clean).toHaveBeenCalledTimes(5);
  });

  it.each([
    "trigger",
    "lifecycle",
    "pollAction",
  ])("applies the component hook once for a %s failure", async (stage) => {
    const failure = new Error("original");
    const handled = new Error("handled");
    const error = vi.fn(async () => handled);
    const failing = async () => {
      throw failure;
    };
    const callable = callableComponent({
      hooks: { error },
      triggers: {
        webhook: trigger({
          display,
          inputs: {},
          scheduleSupport: "invalid",
          synchronousResponseSupport: "valid",
          perform: failing,
          onInstanceDeploy: failing,
        }),
        poll: pollingTrigger({
          display,
          inputs: {},
          pollAction: action({ display, inputs: {}, perform: failing }),
          perform: async (context, receivedPayload, params) => {
            await context.polling.invokeAction(params);
            return { payload: receivedPayload };
          },
        }),
      },
    });
    await expect(
      runWithContext(contextFor(), () =>
        stage === "trigger"
          ? callable.triggers.webhook.perform(payload)
          : stage === "lifecycle"
            ? callable.triggers.webhook.onInstanceDeploy?.()
            : callable.triggers.poll.perform(payload),
      ),
    ).rejects.toBe(handled);
    expect(error).toHaveBeenCalledExactlyOnceWith(failure);
  });

  it("cleans polling inputs once, preserves instance state, and shares enriched context with nested calls", async () => {
    const { field, clean } = parsedInput();
    const inspect = callableComponent({
      actions: {
        current: action({ display, inputs: {}, perform: async (context) => ({ data: context }) }),
      },
    });
    const callable = callableComponent({
      triggers: {
        poll: pollingTrigger({
          display,
          inputs: { limit: input({ type: "number", label: "Limit", default: "2" }) },
          pollAction: action({
            display,
            inputs: { query: field },
            perform: async (context, params) => {
              expect((await inspect.actions.current()).data).toBe(context);
              return { data: params.query.value };
            },
          }),
          perform: async (context, receivedPayload, params) => {
            await Promise.resolve();
            expect(requireContext()).toBe(context);
            expect(params.limit).toBe(2);
            const result = await context.polling.invokeAction(params);
            context.polling.setState({ value: result.data, executionId: context.executionId });
            return { payload: receivedPayload, polledNoChanges: true };
          },
        }),
      },
    });
    const contexts = [contextFor("one"), contextFor("two")];
    const results = await Promise.all(
      contexts.map((context) =>
        runWithContext(context, async () => {
          const result = await callable.triggers.poll.perform(payload);
          expect(requireContext()).toBe(context);
          return result;
        }),
      ),
    );
    expect(results).toEqual([
      { payload, polledNoChanges: true },
      { payload, polledNoChanges: true },
    ]);
    contexts.forEach((context) => {
      expect(context.instanceState).toEqual({
        __prismaticInternal: { polling: { value: "default", executionId: context.executionId } },
      });
    });
    expect(clean).toHaveBeenCalledTimes(2);
  });

  it("preserves batch and initial-deploy resolver semantics, scoped inputs, and nested polling context", async () => {
    const { field, clean } = parsedInput();
    const inspect = callableComponent({
      actions: {
        current: action({ display, inputs: {}, perform: async (context) => ({ data: context }) }),
      },
    });
    const callable = callableComponent({
      triggers: {
        batch: batchTrigger({
          display,
          scheduleSupport: "valid",
          batchConfig: { batchSize: 2 },
          inputs: { query: field },
          perform: async (context, _payload, params) => {
            expect((await inspect.actions.current()).data).toBe(context);
            context.polling.setState({ watermark: "next" });
            return { items: [params.query.value], paginationState: { cursor: "next" } };
          },
          onDeploy: {
            inputs: { start: input({ type: "number", label: "Start", default: "3" }) },
            perform: async (context, _payload, params) => {
              expect((await inspect.actions.current()).data).toBe(context);
              return { items: [`${params.query.value}:${params.start}`], paginationState: null };
            },
          },
        }),
      },
    });
    await runWithContext(contextFor(), async () => {
      const batch = callable.triggers.batch;
      expect(batch.batchConfig).toEqual({ batchSize: 2 });
      const result = await batch.perform(payload);
      if (!result) throw new Error("Missing batch result");
      expect(batch.triggerResolver?.resolveItems?.(result)).toEqual(["default"]);
      expect(batch.triggerResolver?.getNextPaginationState?.(result)).toEqual({ cursor: "next" });
      const deployed = await batch.onDeployPerform?.(payload, { start: 4 });
      if (!deployed) throw new Error("Missing initial-deploy result");
      expect(batch.onDeployResolver?.resolveItems?.(deployed)).toEqual(["default:4"]);
      expect(batch.onDeployResolver?.getNextPaginationState?.(deployed)).toBeNull();
      expect(requireContext().instanceState).toEqual({
        __prismaticInternal: { polling: { watermark: "next" } },
      });
    });
    expect(clean).toHaveBeenCalledTimes(2);
  });

  it.each([
    undefined,
    true,
    false,
  ])("preserves polling result semantics through the generated CNI boundary (%s)", async (polledNoChanges) => {
    const callable = callableComponent({
      triggers: {
        poll: pollingTrigger({
          display,
          inputs: {},
          perform: async (context, receivedPayload) => {
            await Promise.resolve();
            expect(requireContext()).toBe(context);
            if (polledNoChanges === undefined) return undefined;
            return {
              payload: receivedPayload,
              polledNoChanges,
              instanceState: { preserved: true },
            };
          },
        }),
      },
    });
    const cni = integration({
      name: "Bundled polling boundary",
      flows: [
        flow({
          name: "Bundled Poll",
          stableKey: "bundled-poll",
          triggerType: "polling",
          schedule: { value: "*/5 * * * *" },
          onTrigger: async (_context, receivedPayload) =>
            callable.triggers.poll.perform(receivedPayload),
          onExecution: async () => ({ data: true }),
        }),
      ],
    });
    const wire = Object.values(cni.triggers)[0];
    expect(wire.isPollingTrigger).toBe(true);
    const result = await wire.perform(contextFor(), payload, {});
    expect(result).toEqual(
      polledNoChanges === undefined
        ? undefined
        : {
            payload,
            instanceState: { preserved: true },
            resultType: polledNoChanges ? "polled_no_changes" : "completed",
          },
    );
    expect(() => requireContext()).toThrow("ActionContext not found");
  });

  it("rejects duplicate polling and deploy input keys for raw authoring definitions", () => {
    const shared = input({ type: "string", label: "Shared" });
    const poll = pollingTrigger({
      display,
      inputs: { shared },
      pollAction: action({ display, inputs: { shared }, perform: async () => ({ data: true }) }),
      perform: async (_context, payload) => ({ payload }),
    });
    expect(() => callableComponent({ triggers: { poll } })).toThrow("shared");
    const webhook = trigger({
      display,
      inputs: { shared },
      scheduleSupport: "invalid",
      synchronousResponseSupport: "valid",
      batchConfig: { batchSize: 1 },
      perform: async (_context, payload) => ({ payload }),
      onDeployPerform: async (_context, payload) => ({ payload }),
      onDeployResolver: { inputs: { shared }, resolveItems: () => [] },
    });
    expect(() => callableComponent({ triggers: { webhook } })).toThrow("shared");
  });

  it("wires bundled batch and initial-deploy calls through the generated CNI trigger boundary", async () => {
    const callable = callableComponent({
      triggers: {
        batch: batchTrigger({
          display,
          inputs: {},
          scheduleSupport: "valid",
          batchConfig: { batchSize: 2 },
          perform: async (context, receivedPayload) => {
            expect(requireContext()).toBe(context);
            return {
              items: ["page"],
              paginationState: receivedPayload.paginationState ? null : { cursor: "next" },
            };
          },
          onDeploy: {
            perform: async (context) => {
              expect(requireContext()).toBe(context);
              return { items: ["initial"], paginationState: null };
            },
          },
        }),
      },
    });
    const batch = callable.triggers.batch;
    const cni = integration({
      name: "Bundled batched flow",
      flows: [
        flow({
          name: "Bundled Batch",
          stableKey: "bundled-batch",
          batchConfig: { batchSize: 2 },
          trigger: batchFlowTrigger({
            onTrigger: async (_context, receivedPayload) => {
              const result = await batch.perform(receivedPayload);
              if (!result) throw new Error("Missing batch result");
              return {
                items: batch.triggerResolver?.resolveItems?.(result) ?? [],
                paginationState: batch.triggerResolver?.getNextPaginationState?.(result),
              };
            },
            onDeploy: async (_context, receivedPayload) => {
              const result = await batch.onDeployPerform?.(receivedPayload);
              if (!result) throw new Error("Missing initial-deploy result");
              return {
                items: batch.onDeployResolver?.resolveItems?.(result) ?? [],
                paginationState: batch.onDeployResolver?.getNextPaginationState?.(result),
              };
            },
          }),
          onExecution: async () => ({ data: true }),
        }),
      ],
    });
    const wire = Object.values(cni.triggers)[0];
    const context = contextFor();
    const first = await wire.perform(context, payload, {});
    expect(wire.resolveTriggerItems?.(context, first)).toEqual(["page"]);
    expect(wire.getNextPaginationState?.(context, first)).toEqual({ cursor: "next" });
    const last = await wire.perform(
      context,
      { ...payload, paginationState: { cursor: "next" } },
      {},
    );
    expect(wire.getNextPaginationState?.(context, last)).toBeNull();
    const initial = await wire.onDeployPerform?.(context, payload, {});
    expect(wire.resolveOnDeployItems?.(context, initial)).toEqual(["initial"]);
    expect(wire.getOnDeployNextPaginationState?.(context, initial)).toBeNull();
    expect(() => requireContext()).toThrow("ActionContext not found");
  });

  it("isolates bundled batch polling contexts without changing the enclosing CNI context", async () => {
    const inspect = callableComponent({
      actions: {
        current: action({ display, inputs: {}, perform: async (context) => ({ data: context }) }),
      },
    });
    const batch = callableComponent({
      triggers: {
        batch: batchTrigger({
          display,
          inputs: {},
          batchConfig: { batchSize: 1 },
          perform: async (context) => {
            await Promise.resolve();
            expect((await inspect.actions.current()).data).toBe(context);
            context.polling.setState({ execution: context.executionId });
            return { items: [context.executionId] };
          },
          onDeploy: {
            perform: async (context) => {
              await Promise.resolve();
              expect((await inspect.actions.current()).data).toBe(context);
              throw new Error("initial sync failed");
            },
          },
        }),
      },
    }).triggers.batch;
    const cni = integration({
      name: "Nested batch scope",
      flows: [
        flow({
          name: "Nested",
          stableKey: "nested",
          onExecution: async (context) => {
            const result = await batch.perform(payload);
            expect(requireContext()).toBe(context);
            expect(context).not.toHaveProperty("polling");
            await expect(batch.onDeployPerform?.(payload)).rejects.toThrow("initial sync failed");
            expect(requireContext()).toBe(context);
            return { data: result?.payload.body.data };
          },
        }),
      ],
    });
    const contexts = [contextFor("first"), contextFor("second")];
    const perform = Object.values(cni.actions)[0].perform;
    const results = await Promise.all(contexts.map((context) => perform(context, {})));
    expect(results).toEqual([{ data: ["first"] }, { data: ["second"] }]);
    expect(contexts.map((context) => context.instanceState)).toEqual(
      ["first", "second"].map((execution) => ({ __prismaticInternal: { polling: { execution } } })),
    );
    expect(() => requireContext()).toThrow("ActionContext not found");
  });

  it("retains keyed connection definitions for inline config while preserving traditional server entities", () => {
    const api = connection({
      key: "api",
      display,
      inputs: { token: input({ type: "password", label: "Token", required: true }) },
    });
    const server = component({
      key: "entities",
      display: { ...display, iconPath: "icon.png" },
      connections: [api],
    });
    const callable = callableComponent(server);
    expect(callable.connections.api).toBe(api);
    expect(Object.keys(callable.connections)).toEqual(["api"]);
    expect(Array.isArray(server.connections[0].inputs)).toBe(true);
    const cni = integration({
      name: "Inline callable connection",
      flows: [],
      configPages: {
        Configuration: configPage({
          elements: {
            Api: connectionConfigVar({
              ...callable.connections.api,
              stableKey: "api-config",
              dataType: "connection",
            }),
          },
        }),
      },
    });
    expect(cni.connections[0].inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "token", type: "password", required: true }),
      ]),
    );
    expect(() => callableComponent({ connections: [api, api] })).toThrow(
      "Duplicate connection key: api",
    );
  });
});
