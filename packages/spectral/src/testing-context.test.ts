import { describe, expect, it, vi } from "vitest";
import { action, component, dataSource, flow, trigger } from ".";
import { requireContext, runWithContext } from "./serverTypes/asyncContext";
import {
  createHarness,
  createMockContextComponents,
  defaultTriggerPayload,
  invoke,
  invokeDataSource,
  invokeFlow,
  invokeTrigger,
  loggerMock,
} from "./testing";
import type { ActionContext } from "./types";

// Generated manifest helpers read the active context instead of accepting it.
const manifestAction = {
  inputs: { label: { inputType: "string" as const } },
  examplePayload: { data: "example" },
  perform: async (label: string) =>
    (await requireContext().components.fixture.echo({ label })) as { data: string },
};
const registry = { fixture: { actions: { echo: manifestAction } } };
const callerContext = () => ({ executionId: "caller" }) as ActionContext;
const expectScope = (context?: ActionContext) => {
  if (context) expect(requireContext()).toBe(context);
  else expect(() => requireContext()).toThrow("ActionContext not found");
};

describe("invokeFlow execution context", () => {
  it.each([
    "example",
    "override",
  ] as const)("uses %s component mocks and preserves context overrides", async (kind) => {
    const echo = vi.fn(async () => ({ data: "override" }));
    const components = createMockContextComponents(
      registry,
      kind === "override" ? { actions: { fixture: { echo } } } : undefined,
    );
    const logger = loggerMock();
    const invokeFlowMock = vi.fn(async () => ({ data: "mock flow" }));
    const instanceState = {};
    let triggerContext: ActionContext | undefined;
    const tested = flow({
      name: "Mocked flow",
      stableKey: "mocked",
      onTrigger: async (context, payload) => {
        triggerContext = context;
        expectScope(context);
        expect(context.components).toBe(components);
        expect(context.logger).toBe(logger);
        expect(context.instanceState).toBe(instanceState);
        expect(context.configVars).toEqual({ greeting: "hello" });
        expect(context.invokeFlow).toBe(invokeFlowMock);

        await Promise.resolve();
        expectScope(context);
        context.instanceState.triggerRan = true;
        const result = await manifestAction.perform("trigger");
        return { payload: { ...payload, body: { data: result, contentType: "application/json" } } };
      },
      onExecution: async (context, params) => {
        expect(context).toBe(triggerContext);
        expectScope(context);
        expect(context.instanceState.triggerRan).toBe(true);

        await Promise.resolve();
        expectScope(context);
        return {
          data: {
            trigger: params.onTrigger.results.body.data,
            execution: await manifestAction.perform("execution"),
          },
        };
      },
    });

    const actual = await invokeFlow(tested, {
      configVars: { greeting: "hello" },
      context: {
        components,
        logger,
        instanceState,
        invokeFlow: invokeFlowMock as unknown as ActionContext["invokeFlow"],
      },
    });

    expect(actual.result).toEqual({ data: { trigger: { data: kind }, execution: { data: kind } } });
    expect(actual.loggerMock).toBe(logger);
    expect(invokeFlowMock).not.toHaveBeenCalled();
    if (kind === "override")
      expect(echo.mock.calls).toEqual([[{ label: "trigger" }], [{ label: "execution" }]]);
    expectScope();
  });

  it("preserves callback receivers and trigger payload identity", async () => {
    const returnedPayload = { ...defaultTriggerPayload(), body: { data: { custom: true } } };
    const tested = flow({
      name: "Method callbacks",
      stableKey: "methods",
      async onTrigger(context) {
        expect(this).toBe(tested);
        expectScope(context);
        return { payload: returnedPayload };
      },
      async onExecution(context, params) {
        expect(this).toBe(tested);
        expectScope(context);
        expect(params.onTrigger.results).toBe(returnedPayload);
        return { data: true };
      },
    });

    expect((await invokeFlow(tested)).result).toEqual({ data: true });
    expectScope();
  });

  it("isolates simultaneous invocations with distinct component mocks", async () => {
    const tested = flow({
      name: "Concurrent",
      stableKey: "concurrent",
      onTrigger: async (context, payload) => {
        await new Promise((resolve) => setImmediate(resolve));
        expectScope(context);
        expect(await manifestAction.perform("trigger")).toEqual({ data: context.executionId });
        return { payload };
      },
      onExecution: async (context) => {
        await new Promise((resolve) => setImmediate(resolve));
        expectScope(context);
        return await manifestAction.perform("execution");
      },
    });
    const caller = callerContext();

    await runWithContext(caller, async () => {
      const results = await Promise.all(
        ["first", "second"].map((executionId) =>
          invokeFlow(tested, {
            context: {
              executionId,
              components: createMockContextComponents(registry, {
                actions: { fixture: { echo: async () => ({ data: executionId }) } },
              }),
            },
          }),
        ),
      );
      expect(results.map(({ result }) => result)).toEqual([{ data: "first" }, { data: "second" }]);
      expectScope(caller);
    });

    expectScope();
  });

  it.each([
    ["trigger", "synchronous"],
    ["trigger", "asynchronous"],
    ["execution", "synchronous"],
    ["execution", "asynchronous"],
  ] as const)("restores the caller after a %s callback's %s failure", async (phase, failure) => {
    const error = new Error("callback failed");
    const fail = (context: ActionContext): Promise<never> => {
      expectScope(context);
      if (failure === "synchronous") throw error;
      return Promise.resolve().then(() => {
        expectScope(context);
        throw error;
      });
    };
    const execution = vi.fn(fail);
    const tested = flow({
      name: "Failure",
      stableKey: "failure",
      onTrigger: (context, payload) =>
        phase === "trigger" ? fail(context) : Promise.resolve({ payload }),
      onExecution: execution,
    });
    const caller = callerContext();

    await runWithContext(caller, async () => {
      await expect(invokeFlow(tested)).rejects.toBe(error);
      expectScope(caller);
    });

    if (phase === "trigger") expect(execution).not.toHaveBeenCalled();
    expectScope();
  });

  it("binds onExecution with the default trigger and preserves the returned value", async () => {
    const components = createMockContextComponents(registry);
    const expected = { data: "example" };
    const tested = flow({
      name: "Default trigger",
      stableKey: "default-trigger",
      onExecution: async (context, params) => {
        expectScope(context);
        expect(params.onTrigger.results.body.data).toEqual({ custom: true });
        expect(await manifestAction.perform("execution")).toEqual(expected);
        return expected;
      },
    });

    const { result } = await invokeFlow(tested, {
      context: { components },
      payload: { body: { data: { custom: true } } },
    });

    expect(result).toBe(expected);
    expectScope();
  });
});

describe("conventional testing helper scope", () => {
  it.each([
    false,
    true,
  ])("does not create a scope with an enclosing CNI scope: %s", async (nested) => {
    const caller = nested ? callerContext() : undefined;
    const check = async () => {
      expectScope(caller);
      await Promise.resolve();
      expectScope(caller);
    };
    const display = {
      label: "Scope",
      description: "Scope",
      iconPath: "icon.png",
      category: "Helpers",
    };
    const actionDef = action({
      display,
      inputs: {},
      perform: async () => {
        await check();
        return { data: true };
      },
    });
    const event = async () => {
      await check();
      return {};
    };
    const triggerDef = trigger({
      scheduleSupport: "invalid",
      synchronousResponseSupport: "valid",
      display,
      inputs: {},
      perform: async (_context, payload) => {
        await check();
        return { payload };
      },
      onInstanceDeploy: event,
      onInstanceDelete: event,
    });
    const dataSourceDef = dataSource({
      display,
      inputs: {},
      dataSourceType: "string",
      perform: async () => {
        await check();
        return { result: "value" };
      },
    });
    const harness = createHarness(
      component({
        key: "scope",
        display,
        actions: { action: actionDef },
        triggers: { trigger: triggerDef },
        dataSources: { source: dataSourceDef },
      }),
    );
    const run = async () => {
      expect((await invoke(actionDef, {})).result).toEqual({ data: true });
      expect((await invokeTrigger(triggerDef)).result?.payload).toBeDefined();
      expect(await invokeDataSource(dataSourceDef, {})).toEqual({ result: "value" });
      expect(await harness.action("action")).toEqual({ data: true });
      expect((await harness.trigger("trigger"))?.payload).toBeDefined();
      expect(await harness.dataSource("source")).toEqual({ result: "value" });
      expect(await harness.triggerOnInstanceDeploy("trigger")).toEqual({});
      expect(await harness.triggerOnInstanceDelete("trigger")).toEqual({});
      expectScope(caller);
    };

    if (caller) await runWithContext(caller, run);
    else await run();

    expectScope();
  });
});
