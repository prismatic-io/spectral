import { describe, expect, it, vi } from "vitest";
import { callableComponent, component, flow, input, integration, pollingTrigger, trigger } from ".";
import { requireContext, runWithContext } from "./serverTypes/asyncContext";
import { convertFlow } from "./serverTypes/convertIntegration";
import type { ActionContext, Connection, TriggerPayload } from "./types";

const display = { label: "Bound trigger", description: "Bundled flow trigger" };
const payload = { body: { data: {}, contentType: "application/json" } } as TriggerPayload;
const contextFor = (executionId = "execution", configVars: Record<string, unknown> = {}) =>
  ({ executionId, instanceState: {}, configVars, globalDebug: false }) as ActionContext;
const baseFlow = {
  name: "Bound Trigger",
  stableKey: "bound-trigger",
  onExecution: async () => ({ data: true }),
};

describe("bundled component trigger bindings", () => {
  it("binds the desired connection callsite locally and cleans each invocation once", async () => {
    const clean = vi.fn((value: unknown) => String(value).trim());
    const authored = component({
      key: "bound-trigger-component",
      display: { ...display, iconPath: "icon.png" },
      triggers: {
        webhook: trigger({
          display,
          scheduleSupport: "invalid",
          synchronousResponseSupport: "valid",
          inputs: {
            slackConnection: input({ type: "connection", label: "Connection", required: true }),
            label: input({ type: "string", label: "Label", clean }),
          },
          perform: async (context, receivedPayload, params) => {
            await Promise.resolve();
            expect(requireContext()).toBe(context);
            return {
              payload: receivedPayload,
              instanceState: {
                executionId: context.executionId,
                connection: params.slackConnection,
                label: params.label,
              },
            };
          },
        }),
      },
    });
    const callable = callableComponent(authored);
    expect(Array.isArray(authored.triggers.webhook.inputs)).toBe(true);
    const bound = callable.triggers.webhook({
      slackConnection: { configVar: "Org Slack Connection" },
      label: { value: " hello " },
    });
    const definition = flow({ ...baseFlow, onTrigger: bound });
    const cni = integration({ name: "Bound component", flows: [definition] });
    const wire = Object.values(cni.triggers)[0];
    const connections = [
      { fields: { token: "first" } },
      { fields: { token: "second" } },
    ] as Connection[];
    const results = await Promise.all(
      connections.map((connection, index) =>
        wire.perform(
          contextFor(String(index), { "Org Slack Connection": connection }),
          payload,
          {},
        ),
      ),
    );
    expect(results.map((result) => result?.instanceState)).toEqual(
      connections.map((connection, index) => ({
        executionId: String(index),
        connection,
        label: "hello",
      })),
    );
    expect(clean).toHaveBeenCalledTimes(2);
    expect(wire.scheduleSupport).toBe("invalid");
    expect(wire.synchronousResponseSupport).toBe("valid");
    expect(wire.inputs).toEqual([]);
    const serialized = convertFlow(definition, {}, "local-cni");
    expect(serialized.supplementalComponents).toEqual([]);
    expect(serialized.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isTrigger: true,
          action: {
            key: wire.key,
            component: { key: "local-cni", version: "LATEST", isPublic: false },
          },
        }),
      ]),
    );
    expect(() => requireContext()).toThrow("ActionContext not found");
    // The direct-call surface remains available alongside flow binding.
    await runWithContext(contextFor(), () =>
      callable.triggers.webhook.perform(payload, {
        slackConnection: connections[0],
        label: "direct",
      }),
    );
    expect(clean).toHaveBeenCalledTimes(3);
  });

  it("resolves falsy config values at invocation and rejects missing config vars", async () => {
    const callable = callableComponent({
      triggers: {
        webhook: trigger({
          display,
          scheduleSupport: "invalid",
          synchronousResponseSupport: "valid",
          inputs: {
            enabled: input({ type: "boolean", label: "Enabled", clean: (value) => value }),
            label: input({ type: "string", label: "Label", default: "default" }),
          },
          perform: async (_context, receivedPayload, params) => ({
            payload: receivedPayload,
            instanceState: { ...params },
          }),
        }),
      },
    });
    const definition = flow({
      ...baseFlow,
      onTrigger: callable.triggers.webhook({ enabled: { configVar: "Enabled" }, label: "raw" }),
    });
    const wire = Object.values(integration({ name: "Bindings", flows: [definition] }).triggers)[0];
    await expect(
      wire.perform(contextFor("false", { Enabled: false }), payload, {}),
    ).resolves.toMatchObject({
      instanceState: { enabled: false, label: "raw" },
    });
    await expect(wire.perform(contextFor(), payload, {})).rejects.toThrow("Enabled");
  });

  it("automatically composes all lifecycle handlers once with component-first merged results", async () => {
    const order: string[] = [];
    const componentEvent = (name: string) =>
      vi.fn(async (context: ActionContext, params: { label: string }) => {
        expect(requireContext()).toBe(context);
        order.push(`component:${name}`);
        return { instanceState: { component: params.label, shared: "component" } };
      });
    const customEvent = (name: string) =>
      vi.fn(async (context: ActionContext) => {
        expect(requireContext()).toBe(context);
        order.push(`flow:${name}`);
        return { instanceState: { flow: name, shared: "flow" } };
      });
    const deploy = componentEvent("deploy");
    const remove = componentEvent("delete");
    const create = componentEvent("create");
    const deleteWebhook = componentEvent("deleteWebhook");
    const callable = callableComponent({
      triggers: {
        webhook: trigger({
          display,
          scheduleSupport: "invalid",
          synchronousResponseSupport: "valid",
          inputs: { label: input({ type: "string", label: "Label" }) },
          perform: async (_context, receivedPayload) => ({ payload: receivedPayload }),
          onInstanceDeploy: deploy,
          onInstanceDelete: remove,
          webhookLifecycleHandlers: { create, delete: deleteWebhook },
        }),
      },
    });
    const definition = flow({
      ...baseFlow,
      onTrigger: callable.triggers.webhook({ label: { configVar: "Label" } }),
      onInstanceDeploy: customEvent("deploy"),
      onInstanceDelete: customEvent("delete"),
      webhookLifecycleHandlers: {
        create: customEvent("create"),
        delete: customEvent("deleteWebhook"),
      },
    });
    // Independent conversions must not mutate the bound function or accumulate handlers.
    integration({ name: "First conversion", flows: [definition] });
    convertFlow(definition, {}, "local-cni");
    const wire = Object.values(
      integration({ name: "Second conversion", flows: [definition] }).triggers,
    )[0];
    expect(wire.hasOnInstanceDeploy).toBe(true);
    expect(wire.hasOnInstanceDelete).toBe(true);
    expect(wire.hasWebhookCreateFunction).toBe(true);
    expect(wire.hasWebhookDeleteFunction).toBe(true);
    const events = [
      wire.onInstanceDeploy,
      wire.onInstanceDelete,
      wire.webhookCreate,
      wire.webhookDelete,
    ];
    const names = ["deploy", "delete", "create", "deleteWebhook"];
    for (const [index, event] of events.entries()) {
      await expect(event?.(contextFor("lifecycle", { Label: "configured" }), {})).resolves.toEqual({
        instanceState: { component: "configured", flow: names[index], shared: "flow" },
      });
    }
    expect(order).toEqual(names.flatMap((name) => [`component:${name}`, `flow:${name}`]));
    for (const event of [deploy, remove, create, deleteWebhook])
      expect(event).toHaveBeenCalledTimes(1);
    expect(() => requireContext()).toThrow("ActionContext not found");
  });

  it("infers polling semantics, requires a schedule, and preserves polling state and results", async () => {
    const callable = callableComponent({
      triggers: {
        poll: pollingTrigger({
          display,
          inputs: { cursor: input({ type: "string", label: "Cursor", default: "first" }) },
          perform: async (context, receivedPayload, params) => {
            expect(requireContext()).toBe(context);
            context.polling.setState({ cursor: params.cursor });
            return { payload: receivedPayload, polledNoChanges: true };
          },
        }),
      },
    });
    const unscheduled = flow({ ...baseFlow, onTrigger: callable.triggers.poll() });
    expect(() => integration({ name: "Unscheduled", flows: [unscheduled] })).toThrow(/schedule/i);
    const definition = flow({ ...unscheduled, schedule: { value: "*/5 * * * *" } });
    const wire = Object.values(integration({ name: "Polling", flows: [definition] }).triggers)[0];
    expect(wire.isPollingTrigger).toBe(true);
    expect(wire.scheduleSupport).toBe("required");
    const context = contextFor();
    await expect(wire.perform(context, payload, {})).resolves.toMatchObject({
      resultType: "polled_no_changes",
      payload,
    });
    expect(context.instanceState).toEqual({
      __prismaticInternal: { polling: { cursor: "first" } },
    });
    expect(convertFlow(definition, {}, "local-cni").supplementalComponents).toEqual([]);
  });

  it("inherits batching, resolver context, initial-sync behavior, and scoped input cleaning", async () => {
    const cleanStart = vi.fn((value: unknown) => Number(value));
    const resolveItems = vi.fn((context: ActionContext, result: { payload: TriggerPayload }) => {
      expect(requireContext()).toBe(context);
      return [result.payload.body.data];
    });
    const getNextPaginationState = vi.fn((context: ActionContext) => {
      expect(requireContext()).toBe(context);
      return { cursor: "next" };
    });
    const callable = callableComponent({
      triggers: {
        batch: trigger({
          display,
          scheduleSupport: "valid",
          synchronousResponseSupport: "invalid",
          inputs: { label: input({ type: "string", label: "Label", default: "page" }) },
          triggerResolverSupport: "required",
          batchConfig: { batchSize: 3, concurrentBatchLimit: 2 },
          triggerResolver: { resolveItems, getNextPaginationState },
          perform: async (_context, receivedPayload, params) => ({
            payload: { ...receivedPayload, body: { ...receivedPayload.body, data: params.label } },
          }),
          onDeployPerform: async (context, receivedPayload, params) => {
            expect(requireContext()).toBe(context);
            return {
              payload: {
                ...receivedPayload,
                body: { ...receivedPayload.body, data: `${params.label}:${params.start}` },
              },
            };
          },
          onDeployResolver: {
            inputs: {
              start: input({ type: "number", label: "Start", default: "2", clean: cleanStart }),
            },
            resolveItems,
            getNextPaginationState: (context) => {
              expect(requireContext()).toBe(context);
              return null;
            },
          },
        }),
      },
    });
    const definition = flow({
      ...baseFlow,
      runInitialSyncOnDeploy: true,
      onTrigger: callable.triggers.batch({ start: { configVar: "Start" } }),
    });
    const wire = Object.values(integration({ name: "Batching", flows: [definition] }).triggers)[0];
    const serialized = convertFlow(definition, {}, "local-cni");
    expect(serialized.triggerResolver).toEqual({
      batchSize: 3,
      concurrentBatchLimit: 2,
      enabled: true,
      runInitialSyncOnDeploy: true,
    });
    expect(
      convertFlow({ ...definition, runInitialSyncOnDeploy: false }, {}, "local-cni")
        .triggerResolver,
    ).toMatchObject({ runInitialSyncOnDeploy: false });
    expect(serialized.supplementalComponents).toEqual([]);
    expect(wire.triggerResolverDefaultBatchSize).toBe(3);
    expect(wire.triggerResolverDefaultConcurrentBatchLimit).toBe(2);
    expect(wire.hasOnDeployPerform).toBe(true);
    const context = contextFor("batch", { Start: "7" });
    const result = await wire.perform(context, payload, {});
    expect(wire.resolveTriggerItems?.(context, result)).toEqual(["page"]);
    expect(wire.getNextPaginationState?.(context, result)).toEqual({ cursor: "next" });
    expect(cleanStart).not.toHaveBeenCalled();
    const initial = await wire.onDeployPerform?.(context, payload, {});
    expect(wire.resolveOnDeployItems?.(context, initial)).toEqual(["page:7"]);
    expect(wire.getOnDeployNextPaginationState?.(context, initial)).toBeNull();
    expect(cleanStart).toHaveBeenCalledExactlyOnceWith("7");
    expect(() => requireContext()).toThrow("ActionContext not found");
  });

  it("resolves deploy-only bindings only for the initial-sync invocation", async () => {
    const callable = callableComponent({
      triggers: {
        webhook: trigger({
          display,
          scheduleSupport: "invalid",
          synchronousResponseSupport: "valid",
          inputs: { label: input({ type: "string", label: "Label", default: "normal" }) },
          batchConfig: { batchSize: 1 },
          perform: async (_context, receivedPayload, params) => ({
            payload: receivedPayload,
            instanceState: { label: params.label },
          }),
          onInstanceDeploy: async (_context, params) => ({
            instanceState: { label: params.label },
          }),
          onDeployPerform: async (_context, receivedPayload, params) => ({
            payload: receivedPayload,
            instanceState: { start: params.start },
          }),
          onDeployResolver: {
            inputs: { start: input({ type: "number", label: "Start", required: true }) },
            resolveItems: () => [],
          },
        }),
      },
    });
    const definition = flow({
      ...baseFlow,
      onTrigger: callable.triggers.webhook({ start: { configVar: "Initial Start" } }),
    });
    const wire = Object.values(
      integration({ name: "Scoped bindings", flows: [definition] }).triggers,
    )[0];
    const context = contextFor();
    await expect(wire.perform(context, payload, {})).resolves.toMatchObject({
      instanceState: { label: "normal" },
    });
    await expect(wire.onInstanceDeploy?.(context, {})).resolves.toEqual({
      instanceState: { label: "normal" },
    });
    await expect(wire.onDeployPerform?.(context, payload, {})).rejects.toThrow("Initial Start");
    await expect(
      wire.onDeployPerform?.(contextFor("initial", { "Initial Start": "9" }), payload, {}),
    ).resolves.toMatchObject({ instanceState: { start: 9 } });
  });

  it.each([
    "record",
    "array",
    "configVar",
  ] as const)("retains dynamic branch metadata and results with %s bindings without supplemental components", async (kind) => {
    const callable = callableComponent({
      triggers: {
        webhook: trigger({
          display,
          scheduleSupport: "invalid",
          synchronousResponseSupport: "valid",
          allowsBranching: true,
          staticBranchNames: ["Else"],
          dynamicBranchInput: "branches",
          inputs: {
            branches: input({ type: "string", label: "Branches", collection: "keyvaluelist" }),
            privateInput: input({ type: "string", label: "Local input" }),
          },
          perform: async (_context, receivedPayload, params) => ({
            payload: receivedPayload,
            branch: params.branches[0]?.key ?? "Else",
          }),
        }),
      },
    });
    const branches = [{ key: "Ready", value: "go" }];
    const binding =
      kind === "record" ? { Ready: "go" } : kind === "array" ? branches : { configVar: "Branches" };
    const definition = flow({
      ...baseFlow,
      onTrigger: callable.triggers.webhook({ branches: binding, privateInput: "local-only" }),
    });
    const cni = integration({ name: "Dynamic branching", flows: [definition] });
    const wire = Object.values(cni.triggers)[0];
    expect(wire.dynamicBranchInput).toBe("branches");
    expect(wire.allowsBranching).toBe(true);
    expect(wire.staticBranchNames).toEqual(["Else"]);
    expect(wire.inputs).toEqual([
      expect.objectContaining({ key: "branches", collection: "keyvaluelist" }),
    ]);
    const serialized = convertFlow(definition, {}, "local-cni");
    expect(serialized.supplementalComponents).toEqual([]);
    expect(serialized.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isTrigger: true,
          inputs: {
            branches:
              kind === "configVar"
                ? { type: "configVar", value: "Branches" }
                : {
                    type: "complex",
                    value: [
                      { name: { type: "value", value: "Ready" }, type: "value", value: "go" },
                    ],
                  },
          },
        }),
      ]),
    );
    await expect(
      wire.perform(contextFor("branch", { Branches: branches }), payload, {}),
    ).resolves.toMatchObject({
      branch: "Ready",
      payload,
    });
    expect(cni.codeNativeIntegrationYAML).not.toContain("local-only");
  });

  it("rejects dynamic branching metadata that names a missing trigger input", () => {
    const callable = callableComponent({
      triggers: {
        webhook: trigger({
          display,
          scheduleSupport: "invalid",
          synchronousResponseSupport: "valid",
          allowsBranching: true,
          dynamicBranchInput: "missing",
          inputs: {},
          perform: async (_context, receivedPayload) => ({
            payload: receivedPayload,
            branch: "Ready",
          }),
        }),
      },
    });
    const definition = flow({ ...baseFlow, onTrigger: callable.triggers.webhook() });
    expect(() => integration({ name: "Invalid branch input", flows: [definition] })).toThrow(
      /missing.*not defined/i,
    );
  });

  it("keeps unbatched initial-sync methods callable but rejects unsupported automatic dispatch", async () => {
    const callable = callableComponent({
      triggers: {
        webhook: trigger({
          display,
          scheduleSupport: "invalid",
          synchronousResponseSupport: "valid",
          inputs: {},
          perform: async (_context, receivedPayload) => ({ payload: receivedPayload }),
          onDeployPerform: async (_context, receivedPayload) => ({
            payload: receivedPayload,
            instanceState: { initial: true },
          }),
        }),
      },
    });
    const definition = flow({ ...baseFlow, onTrigger: callable.triggers.webhook() });
    for (const runInitialSyncOnDeploy of [undefined, false]) {
      const wire = Object.values(
        integration({
          name: "Manual initial sync",
          flows: [{ ...definition, runInitialSyncOnDeploy }],
        }).triggers,
      )[0];
      await expect(wire.onDeployPerform?.(contextFor(), payload, {})).resolves.toMatchObject({
        instanceState: { initial: true },
      });
    }
    expect(() =>
      integration({
        name: "Unsupported automatic initial sync",
        flows: [{ ...definition, runInitialSyncOnDeploy: true }],
      }),
    ).toThrow(/resolver|batch/i);
  });

  it("supports nonbatched initial-sync results when the normal trigger provides batching", async () => {
    const callable = callableComponent({
      triggers: {
        webhook: trigger({
          display,
          scheduleSupport: "invalid",
          synchronousResponseSupport: "invalid",
          inputs: {},
          triggerResolverSupport: "valid",
          batchConfig: { batchSize: 1 },
          triggerResolver: { resolveItems: (_context, result) => [result.payload.body.data] },
          perform: async (_context, receivedPayload) => ({ payload: receivedPayload }),
          onDeployPerform: async (_context, receivedPayload) => ({
            payload: receivedPayload,
            instanceState: { initial: "single execution" },
          }),
        }),
      },
    });
    const definition = flow({
      ...baseFlow,
      onTrigger: callable.triggers.webhook(),
      runInitialSyncOnDeploy: true,
    });
    const wire = Object.values(
      integration({ name: "Initial sync", flows: [definition] }).triggers,
    )[0];
    expect(convertFlow(definition, {}, "local-cni").triggerResolver).toMatchObject({
      enabled: true,
      runInitialSyncOnDeploy: true,
    });
    expect(wire.resolveOnDeployItems).toBeUndefined();
    await expect(wire.onDeployPerform?.(contextFor(), payload, {})).resolves.toMatchObject({
      payload,
      instanceState: { initial: "single execution" },
    });
  });

  it("preserves publishable optional batch defaults without enabling a missing resolver", () => {
    const callable = callableComponent({
      triggers: {
        webhook: trigger({
          display,
          inputs: {},
          scheduleSupport: "invalid",
          synchronousResponseSupport: "invalid",
          triggerResolverSupport: "valid",
          batchConfig: { batchSize: 4, concurrentBatchLimit: 2 },
          perform: async (_context, receivedPayload) => ({ payload: receivedPayload }),
        }),
      },
    });
    const definition = flow({ ...baseFlow, onTrigger: callable.triggers.webhook() });
    const wire = Object.values(
      integration({ name: "Optional batching", flows: [definition] }).triggers,
    )[0];
    expect(wire.triggerResolverSupport).toBe("valid");
    expect(wire.triggerResolverDefaultBatchSize).toBe(4);
    expect(wire.triggerResolverDefaultConcurrentBatchLimit).toBe(2);
    expect(wire.resolveTriggerItems).toBeUndefined();
    expect(convertFlow(definition, {}, "local-cni").triggerResolver).toBeUndefined();
  });
});
