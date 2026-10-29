import assert from "node:assert/strict";
import { describe, expect, test, vi } from "vitest";
import { callableComponent, dataSource, flow, input, trigger } from ".";
import { runWithContext } from "./serverTypes/asyncContext";
import { getBoundTrigger } from "./serverTypes/boundTrigger";
import { getBundledDataSource } from "./serverTypes/callableConfigVar";
import { createHarness, defaultTriggerPayload } from "./testing";
import type { ActionContext } from "./types";

const display = { label: "Instrumented", description: "Instrumentation regression fixture" };
const emptyFlow = () =>
  flow({
    name: "Instrumentation",
    stableKey: "instrumentation",
    onExecution: async () => ({ data: null }),
  });
const triggerFixture = () => {
  const clean = vi.fn((value: unknown) => String(value).toUpperCase());
  const real = vi.fn();
  const definition = trigger({
    display,
    inputs: { account: input({ label: "Account", type: "string", default: "default", clean }) },
    scheduleSupport: "valid",
    synchronousResponseSupport: "invalid",
    perform: async (_context, payload, params) => {
      real(params);

      return { payload };
    },
    onInstanceDeploy: async (_context, params) => {
      real(params);

      return { instanceState: { account: params.account } };
    },
    webhookLifecycleHandlers: {
      create: async (_context, params) => {
        real(params);

        return { instanceState: { account: params.account } };
      },
      delete: async () => {
        real();
      },
    },
    triggerResolverSupport: "valid",
    batchConfig: { batchSize: 1 },
    triggerResolver: {
      resolveItems: () => {
        real();

        return ["real"];
      },
      getNextPaginationState: () => {
        real();

        return null;
      },
    },
    onDeployPerform: async (_context, payload) => {
      real();

      return { payload };
    },
    onDeployResolver: {
      resolveItems: () => {
        real();

        return ["real-deploy"];
      },
      getNextPaginationState: () => {
        real();

        return null;
      },
    },
  });
  const source = { triggers: { first: definition, second: definition } };

  return { source, real, clean };
};

const setup = () => {
  const fixture = triggerFixture();
  return { ...fixture, calls: callableComponent(fixture.source) };
};

const detailDataSources = () => {
  const real = vi.fn(async () => ({ result: "real" }));
  const leaf = dataSource({ display, inputs: {}, dataSourceType: "string", perform: real });
  const middle = { ...leaf, detailDataSource: "leaf" };
  const root = { ...leaf, detailDataSource: "middle" };

  return { real, dataSources: { root, middle, leaf } };
};

const it = test.extend<{ instrumented: ReturnType<typeof setup> }>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest reads fixture dependencies from destructuring.
  instrumented: async ({}, use) => {
    await use(setup());
  },
});

describe("callable construction instrumentation", () => {
  it("creating callable triggers does not mutate the supplied definition", async () => {
    const { source } = triggerFixture();
    const definition = source.triggers.first;
    // Freeze each execution surface so accidental in-place wrapping fails here.
    Object.freeze(definition.webhookLifecycleHandlers);
    Object.freeze(definition.triggerResolver);
    Object.freeze(definition.onDeployResolver);
    Object.freeze(definition);

    const calls = callableComponent(source);
    const bound = calls.triggers.first({ account: { value: "customer" } });
    const deploy = getBoundTrigger(bound)?.onInstanceDeploy;
    assert(deploy);

    expect(await deploy({ configVars: {} } as ActionContext, {})).toEqual({
      instanceState: { account: "CUSTOMER" },
    });
  });

  it("creating callable data sources does not mutate nested definitions", async () => {
    const { dataSources } = detailDataSources();
    Object.freeze(dataSources.root);
    Object.freeze(dataSources.middle);
    Object.freeze(dataSources.leaf);

    const calls = callableComponent({ dataSources });
    const config = calls.dataSources.root({ stableKey: "immutable", values: {} });
    const middle = getBundledDataSource(config)?.detail;
    const leaf = middle && getBundledDataSource(middle)?.detail;
    assert(leaf);
    const harness = createHarness(emptyFlow());
    harness.mock(calls.dataSources.leaf.perform).mockResolvedValue({ result: "leaf" });

    expect(await harness.configuration((context) => leaf.perform(context, {}))).toEqual({
      result: "leaf",
    });
  });

  it("intercepts lifecycle closures bound before the harness exists, with current config bindings", async ({
    instrumented: { calls, real, clean },
  }) => {
    const bound = calls.triggers.first({ account: { configVar: "Account" } });
    const metadata = getBoundTrigger(bound);
    const deploy = metadata?.onInstanceDeploy;
    const create = metadata?.webhookLifecycleHandlers?.create;

    assert(
      deploy &&
        create &&
        calls.triggers.first.onInstanceDeploy &&
        calls.triggers.first.webhookLifecycleHandlers,
    );

    const harness = createHarness(emptyFlow());
    harness
      .mock(calls.triggers.first.onInstanceDeploy)
      .mockResolvedValue({ instanceState: { deployed: true } });
    harness
      .mock(calls.triggers.first.webhookLifecycleHandlers.create)
      .mockResolvedValue({ instanceState: { created: true } });

    expect(
      await harness.invoke((context) => deploy(context, {}), { configVars: { Account: "first" } }),
    ).toEqual({ instanceState: { deployed: true } });
    expect(
      await harness.invoke((context) => create(context, {}), { configVars: { Account: "second" } }),
    ).toEqual({ instanceState: { created: true } });
    expect(harness.mock(calls.triggers.first.onInstanceDeploy)).toHaveBeenCalledExactlyOnceWith({
      account: "first",
    });

    expect(
      harness.mock(calls.triggers.first.webhookLifecycleHandlers.create),
    ).toHaveBeenCalledExactlyOnceWith({ account: "second" });
    expect(real).not.toHaveBeenCalled();
    expect(clean).not.toHaveBeenCalled();
  });

  it("keeps captured resolver identities distinct across phases, trigger keys, and owners", async ({
    instrumented: { calls, source, real },
  }) => {
    const anotherView = callableComponent(source);
    const anotherOwner = callableComponent({ triggers: source.triggers });
    const resolve = calls.triggers.first.triggerResolver?.resolveItems;
    const deployResolve = calls.triggers.first.onDeployResolver?.resolveItems;
    const same = anotherView.triggers.first.triggerResolver?.resolveItems;
    const otherKey = calls.triggers.second.triggerResolver?.resolveItems;
    const otherOwner = anotherOwner.triggers.first.triggerResolver?.resolveItems;

    assert(resolve && deployResolve && same && otherKey && otherOwner);
    const firstWebhook = calls.triggers.first.webhookLifecycleHandlers?.create;
    const secondWebhook = calls.triggers.second.webhookLifecycleHandlers?.create;

    assert(firstWebhook && secondWebhook);
    const harness = createHarness(emptyFlow());
    harness.mock(firstWebhook).mockResolvedValue({ instanceState: { first: true } });
    harness.mock(secondWebhook).mockResolvedValue({ instanceState: { second: true } });

    expect(await harness.invoke(() => firstWebhook({ account: "one" }))).toEqual({
      instanceState: { first: true },
    });

    expect(await harness.invoke(() => secondWebhook({ account: "two" }))).toEqual({
      instanceState: { second: true },
    });

    expect(harness.mock(firstWebhook)).toHaveBeenCalledExactlyOnceWith({ account: "one" });
    expect(harness.mock(secondWebhook)).toHaveBeenCalledExactlyOnceWith({ account: "two" });
    harness.mock(same).mockReturnValue(["live"]);
    harness.mock(deployResolve).mockReturnValue(["initial"]);
    harness.mock(otherKey).mockReturnValue(["second"]);
    const result = { payload: defaultTriggerPayload() };

    expect(await harness.invoke(() => resolve(result))).toEqual(["live"]);
    expect(await harness.invoke(() => deployResolve(result))).toEqual(["initial"]);
    expect(await harness.invoke(() => otherKey(result))).toEqual(["second"]);
    expect(await harness.invoke(() => otherOwner(result))).toBeUndefined();
    expect(harness.mock(resolve)).toBe(harness.mock(same));
    expect(harness.mock(resolve)).toHaveBeenCalledExactlyOnceWith(result);
    expect(real).not.toHaveBeenCalled();
  });

  it("constructs data-source factories inside mock scope without invoking an execution mock", async () => {
    const real = vi.fn(async () => ({ result: "real" }));
    const calls = callableComponent({
      dataSources: {
        lookup: dataSource({ display, inputs: {}, dataSourceType: "string", perform: real }),
      },
    });

    const harness = createHarness(emptyFlow());
    harness.mock(calls.dataSources.lookup).mockResolvedValue({ result: "mock" });
    const configuration = await harness.configuration(() =>
      calls.dataSources.lookup({ stableKey: "lookup", values: {} }),
    );

    expect(configuration.stableKey).toBe("lookup");
    expect(harness.mock(calls.dataSources.lookup.perform)).not.toHaveBeenCalled();
    expect(await harness.configuration((context) => configuration.perform(context, {}))).toEqual({
      result: "mock",
    });

    expect(harness.mock(calls.dataSources.lookup.perform)).toHaveBeenCalledExactlyOnceWith({});
    expect(real).not.toHaveBeenCalled();
  });

  it("preserves bound real execution and cleaners outside mock scope, including context guards", async ({
    instrumented: { calls, real, clean },
  }) => {
    const bound = calls.triggers.first({ account: { value: "customer" } });
    const deploy = getBoundTrigger(bound)?.onInstanceDeploy;

    assert(deploy && calls.triggers.first.triggerResolver?.resolveItems);
    const context = { configVars: {}, invokeFlow: vi.fn() } as unknown as ActionContext;

    expect(await deploy(context, {})).toEqual({ instanceState: { account: "CUSTOMER" } });
    expect(clean).toHaveBeenCalledExactlyOnceWith("customer");
    expect(real).toHaveBeenCalledExactlyOnceWith({ account: "CUSTOMER" });
    real.mockClear();
    const harness = createHarness(emptyFlow());
    const resolve = calls.triggers.first.triggerResolver.resolveItems;
    await expect(
      harness.configuration(() => resolve({ payload: defaultTriggerPayload() })),
    ).rejects.toThrow("unavailable during configuration");

    expect(harness.mock(resolve)).not.toHaveBeenCalled();
    expect(() => resolve({ payload: defaultTriggerPayload() })).toThrow("ActionContext not found");
    expect(runWithContext(context, () => resolve({ payload: defaultTriggerPayload() }))).toEqual([
      "real",
    ]);
    expect(real).toHaveBeenCalledOnce();
  });

  it("intercepts recursively captured detail data sources", async () => {
    const { real, dataSources } = detailDataSources();
    const calls = callableComponent({ dataSources });
    const config = calls.dataSources.root({ stableKey: "recursive", values: {} });
    const capturedMiddle = getBundledDataSource(config)?.detail;
    const capturedLeaf = capturedMiddle && getBundledDataSource(capturedMiddle)?.detail;

    assert(capturedMiddle && capturedLeaf);
    const harness = createHarness(emptyFlow());
    harness.mock(calls.dataSources.root.perform).mockResolvedValue({ result: "root" });
    harness.mock(calls.dataSources.middle.perform).mockResolvedValue({ result: "middle" });
    harness.mock(calls.dataSources.leaf.perform).mockResolvedValue({ result: "leaf" });

    expect(await harness.configuration((context) => config.perform(context, {}))).toEqual({
      result: "root",
    });

    expect(await harness.configuration((context) => capturedMiddle.perform(context, {}))).toEqual({
      result: "middle",
    });

    expect(await harness.configuration((context) => capturedLeaf.perform(context, {}))).toEqual({
      result: "leaf",
    });

    expect(harness.mock(calls.dataSources.leaf.perform)).toHaveBeenCalledExactlyOnceWith({});
    expect(real).not.toHaveBeenCalled();
  });

  it("retains omitted versus explicit undefined arguments on data-source aliases", async () => {
    const calls = callableComponent({
      dataSources: {
        lookup: dataSource({
          display,
          inputs: {},
          dataSourceType: "string",
          perform: async () => ({ result: "real" }),
        }),
      },
    });

    const harness = createHarness(emptyFlow());
    await harness.configuration(async () => {
      await calls.dataSources.lookup();
      await calls.dataSources.lookup(undefined);
      await calls.dataSources.lookup.perform();
      await calls.dataSources.lookup.perform(undefined);
    });

    expect(harness.mock(calls.dataSources.lookup).mock.calls).toEqual([
      [],
      [undefined],
      [],
      [undefined],
    ]);
  });
});
