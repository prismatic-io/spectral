import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import {
  callableComponent,
  component,
  configPage,
  connection,
  dataSource,
  input,
  integration,
} from ".";
import { requireDataSourceContext } from "./serverTypes/asyncContext";
import type { DataSourceContext } from "./types";

const display = { label: "Factory", description: "Configuration factory" };
const context = {
  configVars: { Connection: { fields: { token: "fixture" } }, Query: " raw " },
} as unknown as DataSourceContext;

describe("callable config-var factories", () => {
  it.each([
    "LATEST",
    2,
  ] as const)("references the published connection at %s without creating an inline connection", (version) => {
    const fixture = callableComponent(
      component({
        key: "published",
        public: true,
        display,
        connections: [
          connection({
            key: "api",
            display,
            inputs: { token: input({ label: "Token", type: "password" }) },
          }),
        ],
      }),
    );
    const cni = integration({
      name: "Connection",
      flows: [],
      configPages: {
        Configuration: configPage({
          elements: {
            Connection: fixture.connections.api({
              stableKey: "connection",
              version,
              values: { token: { value: "default", writeOnly: true } },
            }),
          },
        }),
      },
    });
    expect(cni.connections).toEqual([]);
    const definition = parse(cni.codeNativeIntegrationYAML ?? "");
    expect(definition.requiredConfigVars[0]).toMatchObject({
      connection: { key: "api", component: { key: "published", version, isPublic: true } },
      inputs: { token: { type: "value", value: "default", meta: { writeOnly: true } } },
    });
  });

  it("requires a published component identity for connection declarations", () => {
    const fixture = callableComponent({
      connections: [connection({ key: "api", display, inputs: {} })],
    });
    expect(() => fixture.connections.api({ stableKey: "connection" })).toThrow("component's key");
  });

  it("bundles a config data source and its detail data source with dependency expressions and cleaning", async () => {
    const clean = vi.fn((value: unknown) => {
      if (typeof value !== "string") throw new Error("cleaned twice");
      return { value: value.trim() };
    });
    const inputs = {
      connection: input({ label: "Connection", type: "connection", required: true }),
      query: input({ label: "Query", type: "string", required: true, clean }),
    };
    const fixture = callableComponent({
      dataSources: {
        objects: dataSource({
          display,
          inputs,
          dataSourceType: "objectSelection",
          detailDataSource: "details",
          perform: async (ctx, params) => {
            await Promise.resolve();
            expect(requireDataSourceContext()).toBe(ctx);
            expect(params.connection.fields.token).toBe("fixture");
            return { result: [{ object: { key: params.query.value } }] };
          },
        }),
        details: dataSource({
          display,
          inputs: {
            ...inputs,
            selected: input({ label: "Selected", type: "dynamicObjectSelection" }),
          },
          dataSourceType: "string",
          perform: async (ctx, params) => {
            await Promise.resolve();
            expect(requireDataSourceContext()).toBe(ctx);
            expect(params.connection.fields.token).toBe("fixture");
            return { result: `${params.query.value}:${params.selected}` };
          },
        }),
      },
    });
    const cni = integration({
      name: "Data source factory",
      flows: [],
      configPages: {
        Configuration: configPage({
          elements: {
            Objects: fixture.dataSources.objects({
              stableKey: "objects",
              values: { connection: { configVar: "Connection" }, query: { configVar: "Query" } },
            }),
          },
        }),
      },
    });
    expect(Object.keys(cni.dataSources)).toEqual(["objects", "objects__detail"]);
    expect(cni.dataSources.objects.detailDataSource).toBe("objects__detail");
    expect(cni.dataSources.objects__detail.inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "selected", type: "dynamicObjectSelection" }),
      ]),
    );
    const definition = parse(cni.codeNativeIntegrationYAML ?? "");
    expect(definition.requiredConfigVars[0].inputs).toMatchObject({
      connection: { type: "configVar", value: "Connection" },
      query: { type: "configVar", value: "Query" },
    });
    expect(definition.requiredConfigVars[0].dataSource.component.key).toBe(cni.key);
    await expect(cni.dataSources.objects.perform(context, {})).resolves.toEqual({
      result: [{ object: { key: "raw" } }],
    });
    await expect(
      cni.dataSources.objects__detail.perform(context, { selected: "chosen" }),
    ).resolves.toEqual({ result: "raw:chosen" });
    expect(clean).toHaveBeenCalledTimes(2);
    expect(() => requireDataSourceContext()).toThrow("DataSourceContext not found");
  });

  it("rejects missing and cyclic detail data sources during authoring", () => {
    const make = (detailDataSource: string) =>
      callableComponent({
        dataSources: {
          source: dataSource({
            display,
            inputs: {},
            dataSourceType: "string",
            detailDataSource,
            perform: async () => ({ result: "" }),
          }),
        },
      });
    expect(() => make("missing").dataSources.source({ stableKey: "source", values: {} })).toThrow(
      "Unknown detail data source",
    );
    expect(() => make("source").dataSources.source({ stableKey: "source", values: {} })).toThrow(
      "Circular detail data source",
    );
  });
});
