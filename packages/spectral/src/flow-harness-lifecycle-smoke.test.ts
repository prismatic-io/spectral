import assert from "node:assert/strict";
import { describe, expect, test, vi } from "vitest";
import { action, batchTrigger, callableComponent, dataSource, flow, input, trigger } from ".";
import { getBoundTrigger } from "./serverTypes/boundTrigger";
import { createHarness, defaultTriggerPayload } from "./testing";

// Scenarios drawn from docs/integrations/code-native/{flows,config-wizard}.mdx:
// webhook registration, dependent configuration choices, and initial-sync pagination.
const display = { label: "CRM", description: "CRM fixture" };
const setup = () => {
  const payload = { ...defaultTriggerPayload(), body: { data: { customerId: "c-1" } } };
  const real = vi.fn(() => {
    throw new Error("A dependency escaped the harness");
  });

  const crm = callableComponent({
    actions: {
      register: action({
        display,
        inputs: { url: input({ label: "URL", type: "string" }) },
        perform: real,
      }),
    },
    triggers: {
      changed: trigger({
        display,
        inputs: { account: input({ label: "Account", type: "string" }) },
        scheduleSupport: "invalid",
        synchronousResponseSupport: "valid",
        perform: real,
        examplePayload: { payload },
        onInstanceDeploy: real,
        onInstanceDelete: real,
        webhookLifecycleHandlers: { create: real, delete: real },
      }),
      empty: trigger({
        display,
        inputs: {},
        scheduleSupport: "invalid",
        synchronousResponseSupport: "valid",
        perform: real,
      }),
      initial: batchTrigger({
        display,
        inputs: {},
        scheduleSupport: "valid",
        batchConfig: { batchSize: 2 },
        perform: async () => ({ items: ["real"], paginationState: null }),
        onDeploy: {
          inputs: { start: input({ label: "Start", type: "string" }) },
          perform: async () => ({ items: ["real-deploy"], paginationState: null }),
        },
      }),
    },
    dataSources: {
      channels: dataSource({
        display,
        inputs: { account: input({ label: "Account", type: "string" }) },
        dataSourceType: "picklist",
        perform: async () => {
          real();

          return { result: [{ key: "real", label: "Real" }] };
        },
        examplePayload: { result: [{ key: "support", label: "Support" }] },
      }),
      empty: dataSource({ display, inputs: {}, dataSourceType: "string", perform: real }),
    },
  });

  const tested = flow({
    name: "Customer changed",
    stableKey: "customer-changed",
    onExecution: async (_context, params) => ({ data: params.onTrigger.results }),
  });

  return { crm, real, tested, payload };
};

const it = test.extend<{ scenario: ReturnType<typeof setup> }>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest reads fixture dependencies from destructuring.
  scenario: async ({}, use) => {
    const scenario = setup();
    await use(scenario);

    // Every scenario must keep imported dependency code out of execution.
    expect(scenario.real).not.toHaveBeenCalled();
  },
});

describe("CNI lifecycle and configuration smoke scenarios", () => {
  it("runs an inline CNI trigger as real logic while mocking its dependency", async ({
    scenario: { crm, payload },
  }) => {
    const triggerLogic = vi.fn(async (_context, received) => {
      await crm.actions.register({ url: "https://example.com/challenge" });

      return { payload: { ...received, body: { data: "verified" } } };
    });

    const harness = createHarness(
      flow({
        name: "Verify",
        stableKey: "verify",
        onTrigger: triggerLogic,
        onExecution: async (_context, params) => ({ data: params.onTrigger.results.body.data }),
      }),
    );

    expect((await harness.run({ payload })).result).toEqual({ data: "verified" });
    expect(triggerLogic).toHaveBeenCalledOnce();
    expect(harness.mock(crm.actions.register)).toHaveBeenCalledExactlyOnceWith({
      url: "https://example.com/challenge",
    });
  });

  it("preserves trigger metadata and resolves config-variable bindings before interception", async ({
    scenario: { crm, tested, payload },
  }) => {
    const bound = crm.triggers.changed({ account: { configVar: "Account" } });
    const harness = createHarness({ ...tested, onTrigger: bound });

    expect(crm.triggers.changed.scheduleSupport).toBe("invalid");
    expect((await harness.run({ configVars: { Account: "acme" }, payload })).result).toEqual({
      data: payload,
    });

    expect(harness.mock(crm.triggers.changed.perform)).toHaveBeenCalledWith(payload, {
      account: "acme",
    });
  });

  it("detects invalid trigger binding even though its perform is mocked", async ({
    scenario: { crm, tested },
  }) => {
    const harness = createHarness({
      ...tested,
      onTrigger: crm.triggers.changed({ account: { configVar: "Missing" } }),
    });

    await expect(harness.run()).rejects.toThrow(
      'Missing config variable for trigger input "account"',
    );

    expect(harness.mock(crm.triggers.changed.perform)).not.toHaveBeenCalled();
  });

  it("leaves a trigger with no example empty without executing its real function", async ({
    scenario: { crm, tested },
  }) => {
    const harness = createHarness({ ...tested, onTrigger: crm.triggers.empty() });

    expect((await harness.run()).result).toEqual({ data: undefined });
    expect(harness.mock(crm.triggers.empty.perform)).toHaveBeenCalledOnce();
  });

  it("composes bound trigger lifecycle responses with real CNI lifecycle logic", async ({
    scenario: { crm, tested },
  }) => {
    assert(crm.triggers.changed.onInstanceDeploy);
    const deployed = vi.fn(async () => {
      await crm.actions.register({ url: "https://example.com/webhook" });

      return { instanceState: { fromFlow: true } };
    });

    const harness = createHarness({
      ...tested,
      onTrigger: crm.triggers.changed({ account: { value: "acme" } }),
      onInstanceDeploy: deployed,
    });
    harness
      .mock(crm.triggers.changed.onInstanceDeploy)
      .mockResolvedValue({ instanceState: { fromTrigger: true } });

    expect(await harness.onInstanceDeploy()).toEqual({
      instanceState: { fromTrigger: true, fromFlow: true },
    });

    expect(harness.mock(crm.triggers.changed.onInstanceDeploy)).toHaveBeenCalledExactlyOnceWith({
      account: "acme",
    });

    expect(harness.mock(crm.actions.register)).toHaveBeenCalledOnce();
    expect(deployed).toHaveBeenCalledOnce();
  });

  it("runs deletion explicitly and never deploys or deletes during normal execution", async ({
    scenario: { crm, tested },
  }) => {
    const harness = createHarness({
      ...tested,
      onTrigger: crm.triggers.changed({ account: { value: "acme" } }),
    });

    assert(crm.triggers.changed.onInstanceDeploy && crm.triggers.changed.onInstanceDelete);
    await harness.run();

    expect(harness.mock(crm.triggers.changed.onInstanceDeploy)).not.toHaveBeenCalled();
    expect(harness.mock(crm.triggers.changed.onInstanceDelete)).not.toHaveBeenCalled();
    harness
      .mock(crm.triggers.changed.onInstanceDelete)
      .mockResolvedValue({ instanceState: { deleted: true } });

    expect(await harness.onInstanceDelete()).toEqual({ instanceState: { deleted: true } });
    expect(harness.mock(crm.triggers.changed.onInstanceDelete)).toHaveBeenCalledExactlyOnceWith({
      account: "acme",
    });
  });

  it("can test webhook listening-mode create and delete independently", async ({
    scenario: { crm, tested },
  }) => {
    const bound = crm.triggers.changed({ account: { value: "acme" } });
    const normalized = getBoundTrigger(bound);
    const harness = createHarness({ ...tested, onTrigger: bound });

    assert(normalized?.webhookLifecycleHandlers);
    assert(crm.triggers.changed.webhookLifecycleHandlers);
    harness
      .mock(crm.triggers.changed.webhookLifecycleHandlers.create)
      .mockResolvedValue({ instanceState: { webhookId: "w-1" } });

    expect(
      await harness.invoke((context) => normalized.webhookLifecycleHandlers?.create(context, {})),
    ).toEqual({ instanceState: { webhookId: "w-1" } });
    expect(
      await harness.invoke((context) => normalized.webhookLifecycleHandlers?.delete(context, {})),
    ).toBeUndefined();
    expect(
      harness.mock(crm.triggers.changed.webhookLifecycleHandlers.create),
    ).toHaveBeenCalledExactlyOnceWith({ account: "acme" });
    expect(
      harness.mock(crm.triggers.changed.webhookLifecycleHandlers.delete),
    ).toHaveBeenCalledExactlyOnceWith({ account: "acme" });
  });

  it("uses data-source examples in configuration and shares direct/factory call history", async ({
    scenario: { crm, tested },
  }) => {
    const harness = createHarness(tested);
    const definition = crm.dataSources.channels({
      stableKey: "channel",
      values: { account: { configVar: "Account" } },
    });

    const selected = await harness.configuration((context) => definition.perform(context, {}), {
      configVars: { Account: "acme" },
    });

    expect(selected).toEqual({ result: [{ key: "support", label: "Support" }] });
    expect(harness.mock(crm.dataSources.channels.perform)).toHaveBeenCalledExactlyOnceWith({
      account: "acme",
    });

    expect(harness.mock(crm.dataSources.channels)).toBe(
      harness.mock(crm.dataSources.channels.perform),
    );

    await harness.configuration(() => crm.dataSources.channels.perform({ account: "other" }));

    expect(harness.mock(crm.dataSources.channels.perform)).toHaveBeenCalledTimes(2);
  });

  it("keeps missing data-source mocks empty and preserves configuration restrictions", async ({
    scenario: { crm, tested, payload },
  }) => {
    const harness = createHarness(tested);

    expect(await harness.configuration(() => crm.dataSources.empty.perform())).toBeUndefined();
    await expect(
      harness.configuration(() => crm.triggers.changed.perform(payload)),
    ).rejects.toThrow("unavailable during configuration");
  });

  it("mocks initial-sync perform and both resolver pairs independently", async ({
    scenario: { crm, tested, payload },
  }) => {
    const harness = createHarness(tested);
    const batch = crm.triggers.initial;

    assert(
      batch.onDeployPerform &&
        batch.triggerResolver?.resolveItems &&
        batch.triggerResolver.getNextPaginationState &&
        batch.onDeployResolver?.resolveItems &&
        batch.onDeployResolver.getNextPaginationState,
    );

    expect(
      await harness.invoke(() => batch.onDeployPerform?.(payload, { start: "yesterday" })),
    ).toBeUndefined();
    harness
      .mock(batch.onDeployPerform)
      .mockResolvedValue({ payload: { ...payload, body: { data: ["history"] } } });
    harness.mock(batch.triggerResolver.resolveItems).mockReturnValue(["live"]);
    harness.mock(batch.triggerResolver.getNextPaginationState).mockReturnValue({ cursor: "next" });
    harness.mock(batch.onDeployResolver.resolveItems).mockReturnValue(["historical"]);
    harness.mock(batch.onDeployResolver.getNextPaginationState).mockReturnValue(null);
    const page = { payload };

    expect(
      await harness.invoke(() => batch.onDeployPerform?.(payload, { start: "yesterday" })),
    ).toEqual({ payload: { ...payload, body: { data: ["history"] } } });
    expect(await harness.invoke(() => batch.triggerResolver?.resolveItems?.(page))).toEqual([
      "live",
    ]);
    expect(
      await harness.invoke(() => batch.triggerResolver?.getNextPaginationState?.(page)),
    ).toEqual({ cursor: "next" });
    expect(await harness.invoke(() => batch.onDeployResolver?.resolveItems?.(page))).toEqual([
      "historical",
    ]);
    expect(
      await harness.invoke(() => batch.onDeployResolver?.getNextPaginationState?.(page)),
    ).toBeNull();
    expect(harness.mock(batch.triggerResolver.resolveItems)).toHaveBeenCalledExactlyOnceWith(page);
  });

  it("resolves on-deploy-only bindings before invoking its mock", async ({
    scenario: { crm, tested, payload },
  }) => {
    const bound = crm.triggers.initial({ start: { configVar: "Backfill Start" } });
    const metadata = getBoundTrigger(bound);

    assert(metadata?.onDeployTrigger && crm.triggers.initial.onDeployPerform);
    const harness = createHarness({ ...tested, onTrigger: bound });
    const result = { payload };
    harness.mock(crm.triggers.initial.onDeployPerform).mockResolvedValue(result);

    expect(
      await harness.invoke((context) => metadata.onDeployTrigger?.(context, payload, {}), {
        configVars: { "Backfill Start": "2026-01-01" },
      }),
    ).toEqual(result);
    expect(harness.mock(crm.triggers.initial.onDeployPerform)).toHaveBeenCalledExactlyOnceWith(
      payload,
      { start: "2026-01-01" },
    );

    expect(harness.mock(crm.triggers.initial.perform)).not.toHaveBeenCalled();
  });

  it("checks missing configuration bindings and allows explicit invocation params", async ({
    scenario: { crm, tested },
  }) => {
    const harness = createHarness(tested);
    const definition = crm.dataSources.channels({
      stableKey: "channels",
      values: { account: { configVar: "Account" } },
    });

    await expect(
      harness.configuration((context) => definition.perform(context, {})),
    ).rejects.toThrow('Missing config variable for data source input "account"');

    expect(harness.mock(crm.dataSources.channels.perform)).not.toHaveBeenCalled();
    await harness.configuration((context) => definition.perform(context, { account: "explicit" }), {
      configVars: { Account: "configured" },
    });

    expect(harness.mock(crm.dataSources.channels.perform)).toHaveBeenCalledExactlyOnceWith({
      account: "explicit",
    });
  });

  it("leaves absent flow lifecycle methods empty", async ({ scenario: { tested } }) => {
    const harness = createHarness(tested);

    expect(await harness.onInstanceDeploy()).toBeUndefined();
    expect(await harness.onInstanceDelete()).toBeUndefined();
  });

  it("diagnoses missing bound batch trigger mocks", async ({ scenario: { crm, tested } }) => {
    const harness = createHarness({ ...tested, onTrigger: crm.triggers.initial() });
    await expect(async () => harness.run()).rejects.toThrow("returned no payload");
  });
});
