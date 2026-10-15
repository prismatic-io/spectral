import { describe, expect, it } from "vitest";
import { configPage, dataSourceConfigVar, integration } from "..";
import type { ActionContext, DataSourceContext } from "../types";
import {
  requireContext,
  requireDataSourceContext,
  runWithContext,
  runWithDataSourceContext,
} from "./asyncContext";
import { convertConfigurationInit, convertServerFunction } from "./convertIntegrationConfiguration";

const contextFor = (name: string): DataSourceContext =>
  ({
    configVars: { name },
    logger: { info: () => {} },
    customer: { name },
    instance: { name },
    user: { name },
  }) as DataSourceContext;

describe("configuration-time context scope", () => {
  it("shares execution context with data sources and restores it after a narrower callback", async () => {
    const execution = { ...contextFor("execution"), executionId: "execution" } as ActionContext;
    const configuration = contextFor("configuration");
    await runWithContext(execution, async () => {
      expect(requireDataSourceContext()).toBe(execution);
      await expect(
        runWithDataSourceContext(configuration, async () => {
          await Promise.resolve();
          expect(requireDataSourceContext()).toBe(configuration);
          expect(() => requireContext()).toThrow("unavailable during configuration");
          throw new Error("configuration failure");
        }),
      ).rejects.toThrow("configuration failure");
      expect(requireContext()).toBe(execution);
      expect(requireDataSourceContext()).toBe(execution);
    });
    expect(() => requireDataSourceContext()).toThrow("DataSourceContext not found");
    expect(() => requireContext()).toThrow("ActionContext not found");
  });

  it("binds generated config-page data sources with their exact configuration context", async () => {
    const converted = integration({
      name: "Callable configuration context",
      flows: [],
      configPages: {
        Configuration: configPage({
          elements: {
            choice: dataSourceConfigVar({
              stableKey: "choice",
              dataSourceType: "picklist",
              perform: async (context) => {
                await Promise.resolve();
                expect(requireDataSourceContext()).toBe(context);
                expect(() => requireContext()).toThrow("unavailable during configuration");
                return { result: [String(requireDataSourceContext().configVars.name)] };
              },
            }),
          },
        }),
      },
    });
    const perform = converted.dataSources.choice.perform;
    const results = await Promise.all(["one", "two"].map((name) => perform(contextFor(name), {})));
    expect(results).toEqual([{ result: ["one"] }, { result: ["two"] }]);
    expect(() => requireDataSourceContext()).toThrow("DataSourceContext not found");
  });

  it("binds init and server functions without granting execution-only APIs", async () => {
    const verifyContext = async () => {
      await Promise.resolve();
      const context = requireDataSourceContext();
      expect(Object.keys(context).sort()).toEqual([
        "configVars",
        "customer",
        "instance",
        "logger",
        "user",
      ]);
      expect(() => requireContext()).toThrow("unavailable during configuration");
      return context;
    };
    const init = convertConfigurationInit(verifyContext);
    const serverFunction = convertServerFunction({
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      perform: verifyContext,
    });
    const contexts = [contextFor("init"), contextFor("server")];
    const results = await Promise.all([init(contexts[0]), serverFunction(contexts[1], {})]);
    expect(results).toEqual(contexts);
    results.forEach((result, index) => {
      expect((result as DataSourceContext).logger).toBe(contexts[index].logger);
      expect((result as DataSourceContext).configVars).toBe(contexts[index].configVars);
    });
    expect(() => requireDataSourceContext()).toThrow("DataSourceContext not found");
  });
});
