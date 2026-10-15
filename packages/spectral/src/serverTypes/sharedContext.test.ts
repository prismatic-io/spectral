import { describe, expect, it, vi } from "vitest";
import type { ActionContext, DataSourceContext, IntegrationDefinition } from "../types";

const loadCopies = async () => {
  vi.resetModules();
  const first = await import("./asyncContext");
  vi.resetModules();
  const second = await import("./asyncContext");
  const { callableComponent } = await import("../callableComponent");
  expect(first.runWithContext).not.toBe(second.runWithContext);
  return { first, second, callableComponent };
};

describe("context shared between independent Spectral copies", () => {
  it("shares execution context with bundled actions and isolates concurrent failures", async () => {
    const { first, second, callableComponent } = await loadCopies();
    const bundled = callableComponent({
      actions: {
        inspect: {
          display: { label: "Inspect", description: "Inspect shared context" },
          inputs: {},
          perform: async (context: ActionContext) => {
            await Promise.resolve();
            expect(first.requireContext()).toBe(context);
            expect(second.requireContext()).toBe(context);
            if (context.executionId === "fail") throw new Error("expected failure");
            return { data: context.executionId };
          },
        },
      },
    });
    const parent = { executionId: "parent" } as ActionContext;
    await first.runWithContext(parent, async () => {
      const results = await Promise.allSettled(
        ["one", "two", "fail"].map((executionId) =>
          first.runWithContext({ executionId } as ActionContext, () => bundled.actions.inspect()),
        ),
      );
      expect(results).toEqual([
        { status: "fulfilled", value: { data: "one" } },
        { status: "fulfilled", value: { data: "two" } },
        { status: "rejected", reason: new Error("expected failure") },
      ]);
      expect(second.requireContext()).toBe(parent);
    });
    expect(() => first.requireContext()).toThrow("ActionContext not found");
    expect(() => second.requireContext()).toThrow("ActionContext not found");
  });

  it("shares configuration scope without granting execution APIs and restores outer scope", async () => {
    const { first, second } = await loadCopies();
    const outer = { executionId: "outer" } as ActionContext;
    const configuration = { configVars: {} } as DataSourceContext;
    await first.runWithContext(outer, async () => {
      await expect(
        second.runWithDataSourceContext(configuration, async () => {
          await Promise.resolve();
          expect(first.requireDataSourceContext()).toBe(configuration);
          expect(second.requireDataSourceContext()).toBe(configuration);
          expect(() => first.requireContext()).toThrow("unavailable during configuration");
          expect(() => second.requireContext()).toThrow("unavailable during configuration");
          throw new Error("configuration failure");
        }),
      ).rejects.toThrow("configuration failure");
      expect(second.requireContext()).toBe(outer);
    });
    expect(() => second.requireDataSourceContext()).toThrow("DataSourceContext not found");
  });

  it("shares integration construction scope across copies", async () => {
    const { first, second } = await loadCopies();
    const integration = { name: "Shared", flows: [] } as IntegrationDefinition;
    await first.runWithIntegrationContext(integration, async () => {
      await Promise.resolve();
      expect(second.requireIntegrationContext()).toBe(integration);
      const nested = { name: "Nested", flows: [] } as IntegrationDefinition;
      second.runWithIntegrationContext(nested, () => {
        expect(first.requireIntegrationContext()).toBe(nested);
      });
      expect(second.requireIntegrationContext()).toBe(integration);
    });
  });
});
