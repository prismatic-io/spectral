import assert from "node:assert/strict";
import { describe, expect, it, vi } from "vitest";
import {
  action,
  batchTrigger,
  callableComponent,
  component,
  dataSource,
  flow,
  input,
  trigger,
} from ".";
import { runWithContext } from "./serverTypes/asyncContext";
import { createHarness, defaultTriggerPayload, invokeFlow } from "./testing";
import type { ActionContext } from "./types";

const display = { label: "Fixture", description: "Fixture", iconPath: "icon.png" };
const setup = () => {
  const real = vi.fn(async () => ({ data: { value: "real" } }));
  const cleaner = vi.fn((value: unknown) => String(value));
  const examplePayload = { data: { value: "example" } };
  const source = component({
    key: "fixture",
    display,
    actions: {
      echo: action({
        display,
        inputs: { text: input({ type: "string", label: "Text", required: true, clean: cleaner }) },
        perform: real,
        examplePayload,
      }),
      empty: action({ display, inputs: {}, perform: real }),
    },
    dataSources: {
      options: dataSource({
        display,
        inputs: {},
        dataSourceType: "string",
        perform: async () => ({ result: "real" }),
        examplePayload: { result: "example" },
      }),
    },
    triggers: {
      webhook: trigger({
        display,
        inputs: {},
        scheduleSupport: "invalid",
        synchronousResponseSupport: "valid",
        perform: async (_context, payload) => ({ payload }),
        examplePayload: { payload: defaultTriggerPayload() },
      }),
    },
  });

  const calls = callableComponent(source);
  const captured = calls.actions.echo;
  const helper = () => captured({ text: "hello" });
  const tested = flow({ name: "Fixture", stableKey: "fixture", onExecution: helper });

  return { source, calls, real, cleaner, examplePayload, tested, harness: createHarness(tested) };
};

const test = it.extend<{ fixture: ReturnType<typeof setup> }>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest fixtures require destructuring their context.
  fixture: async ({}, use) => {
    await use(setup());
  },
});

describe("CNI harness", () => {
  test("clones binary and date examples without sharing mutable data", async () => {
    const examplePayload = { data: { bytes: Buffer.from([1]), date: new Date(0) } };
    const calls = callableComponent({
      actions: {
        read: action({
          display,
          inputs: {},
          perform: async () => examplePayload,
          examplePayload,
        }),
      },
    });

    const harness = createHarness(
      flow({ name: "Binary", stableKey: "binary", onExecution: () => calls.actions.read() }),
    );

    const first = (await harness.run()).result;

    assert(first);
    first.data.bytes[0] = 9;
    first.data.date.setFullYear(2000);

    expect((await harness.run()).result).toEqual({
      data: { bytes: Buffer.from([1]), date: new Date(0) },
    });

    expect(examplePayload).toEqual({ data: { bytes: Buffer.from([1]), date: new Date(0) } });
  });

  test("automatically mocks captured callable references with fresh examples", async ({
    fixture: { calls, real, cleaner, examplePayload, harness },
  }) => {
    const first = await harness.run();

    expect(first.result).toEqual(examplePayload);
    assert(first.result);
    first.result.data.value = "mutated";

    expect((await harness.run()).result).toEqual({ data: { value: "example" } });
    expect(examplePayload.data.value).toBe("example");
    expect(harness.mock(calls.actions.echo)).toHaveBeenCalledTimes(2);
    expect(harness.mock(calls.actions.echo)).toHaveBeenCalledWith({ text: "hello" });
    expect(vi.isMockFunction(harness.mock(calls.actions.echo))).toBe(true);
    expect(real).not.toHaveBeenCalled();
    expect(cleaner).not.toHaveBeenCalled();
  });

  test("returns promises for automatic examples, including callers using then", async ({
    fixture: { calls, harness },
  }) => {
    expect(
      await harness.invoke(() =>
        calls.actions.echo({ text: "hello" }).then(({ data }) => data.value),
      ),
    ).toBe("example");
  });

  test("supports typed overrides, one-off responses, rejections, and native assertions", async ({
    fixture: { calls, harness },
  }) => {
    const mock = harness.mock(calls.actions.echo);
    const failure = new Error("offline");
    mock
      .mockResolvedValueOnce({ data: { value: "first" } })
      .mockRejectedValueOnce(failure)
      .mockImplementation(async ({ text }) => ({ data: { value: text } }));

    expect((await harness.run()).result).toEqual({ data: { value: "first" } });
    await expect(harness.run()).rejects.toBe(failure);

    expect((await harness.run()).result).toEqual({ data: { value: "hello" } });
    expect(harness.mock(calls.actions.echo)).toBe(mock);
    expect(mock).toHaveBeenCalledTimes(3);
  });

  test("returns undefined for unconfigured methods without calling real implementations", async ({
    fixture: { calls, real, harness },
  }) => {
    expect(await harness.invoke(() => calls.actions.empty())).toBeUndefined();
    expect(harness.mock(calls.actions.empty)).toHaveBeenCalledExactlyOnceWith();
    expect(real).not.toHaveBeenCalled();
  });

  test("shares mocks across callable views of the same component", async ({
    fixture: { source, calls, harness },
  }) => {
    const other = callableComponent(source);
    harness.mock(other.actions.echo).mockResolvedValue({ data: { value: "other" } });

    expect((await harness.run()).result).toEqual({ data: { value: "other" } });
    expect(harness.mock(calls.actions.echo)).toBe(harness.mock(other.actions.echo));
  });

  test("distinguishes component and entity keys even when definitions are reused", async () => {
    const shared = action({
      display,
      inputs: {},
      perform: async () => ({ data: "real" }),
      examplePayload: { data: "example" },
    });

    const first = callableComponent({ actions: { one: shared, two: shared } });
    const second = callableComponent({ actions: { one: shared } });
    const harness = createHarness(
      flow({ name: "Identity", stableKey: "identity", onExecution: () => first.actions.one() }),
    );
    harness.mock(first.actions.one).mockResolvedValue({ data: "override" });

    expect(await harness.invoke(() => first.actions.one())).toEqual({ data: "override" });
    expect(await harness.invoke(() => first.actions.two())).toEqual({ data: "example" });
    expect(await harness.invoke(() => second.actions.one())).toEqual({ data: "example" });
  });

  test("isolates concurrent and nested harnesses and restores real calls after errors", async ({
    fixture: { calls, tested, real },
  }) => {
    const first = createHarness(tested);
    const second = createHarness(tested);
    first.mock(calls.actions.echo).mockImplementation(async () => {
      await new Promise((resolve) => setImmediate(resolve));

      return { data: { value: "first" } };
    });
    second.mock(calls.actions.echo).mockResolvedValue({ data: { value: "second" } });

    expect(
      (await Promise.all([first.run(), second.run()])).map(({ result }) => result?.data.value),
    ).toEqual(["first", "second"]);
    await first.invoke(async () => {
      expect((await second.run()).result?.data.value).toBe("second");
      expect((await calls.actions.echo({ text: "nested" })).data.value).toBe("first");
    });

    await expect(
      first.invoke(() => {
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    await runWithContext({} as ActionContext, () => calls.actions.echo({ text: "outside" }));

    expect(real).toHaveBeenCalledTimes(1);
  });

  test("mocks data sources in execution and configuration, preserving their factory", async ({
    fixture: { calls, harness },
  }) => {
    expect(await harness.invoke(() => calls.dataSources.options())).toEqual({ result: "example" });
    harness.mock(calls.dataSources.options.perform).mockResolvedValue({ result: "configured" });
    const definition = calls.dataSources.options({ stableKey: "options", values: {} });

    expect(definition.dataSourceType).toBe("string");
    assert(definition.perform);
    expect(await harness.configuration((context) => definition.perform?.(context, {}))).toEqual({
      result: "configured",
    });

    expect(harness.mock(calls.dataSources.options.perform)).toHaveBeenCalledTimes(2);
    await expect(
      harness.configuration(() => calls.actions.echo({ text: "invalid" })),
    ).rejects.toThrow("unavailable during configuration");
  });

  test("mocks directly invoked trigger execution", async ({ fixture: { calls, harness } }) => {
    const payload = { ...defaultTriggerPayload(), body: { data: "event" } };
    harness.mock(calls.triggers.webhook.perform).mockResolvedValue({ payload });

    expect(await harness.invoke(() => calls.triggers.webhook.perform(payload))).toEqual({
      payload,
    });

    expect(harness.mock(calls.triggers.webhook.perform)).toHaveBeenCalledTimes(1);
  });

  test("keeps component harnesses real and rejects non-callable mock targets", async ({
    fixture: { tested, source, real },
  }) => {
    await createHarness(source).action("echo", { text: "real" });

    expect(real).toHaveBeenCalledTimes(1);
    expect(() => createHarness(tested).mock(async () => 1)).toThrow(
      "Expected a Spectral callable method",
    );
  });

  test("keeps legacy invokeFlow callables real while honoring context.components overrides", async ({
    fixture: { calls, real },
  }) => {
    const legacy = vi.fn(async () => ({ data: "legacy mock" }));
    const tested = flow({
      name: "Legacy",
      stableKey: "legacy",
      onExecution: async (context) => ({
        data: [
          await context.components.fixture.echo({}),
          await calls.actions.echo({ text: "real" }),
        ],
      }),
    });

    expect(
      (await invokeFlow(tested, { context: { components: { fixture: { echo: legacy } } } })).result,
    ).toEqual({ data: [{ data: "legacy mock" }, { data: { value: "real" } }] });
    expect(legacy).toHaveBeenCalledOnce();
    expect(real).toHaveBeenCalledOnce();
  });

  test("keeps dependencies called by an override inside the same mock scope", async ({
    fixture: { calls, real, harness },
  }) => {
    harness.mock(calls.actions.empty).mockResolvedValue({ data: { value: "dependency" } });
    harness.mock(calls.actions.echo).mockImplementation(async () => calls.actions.empty());

    expect((await harness.run()).result).toEqual({ data: { value: "dependency" } });
    expect(harness.mock(calls.actions.empty)).toHaveBeenCalledOnce();
    expect(real).not.toHaveBeenCalled();
  });
});

test("diagnoses missing bound batch trigger mocks", async () => {
  const calls = callableComponent({
    triggers: {
      batch: batchTrigger({
        display,
        inputs: {},
        scheduleSupport: "valid",
        batchConfig: { batchSize: 1 },
        perform: async (_context, payload) => ({ payload }),
      }),
    },
  });
  const harness = createHarness(
    flow({
      name: "Batch boundary",
      stableKey: "batch-boundary",
      onTrigger: calls.triggers.batch(),
      onExecution: async () => ({ data: null }),
    }),
  );

  await expect(async () => harness.run()).rejects.toThrow("returned no payload");
});
