import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import {
  callableComponent,
  component,
  configPage,
  connection,
  dataSource,
  dataSourceConfigVar,
  input,
  integration,
} from ".";
import { requireDataSourceContext } from "./serverTypes/asyncContext";
import type { DataSourceContext } from "./types";

const display = { label: "Factory", description: "Configuration factory" };
const signature = "__PRISMATIC_COMPONENT_SELF__";
const context = {
  configVars: { Connection: { fields: { token: "fixture" } }, Query: " raw ", Parent: "filter" },
} as unknown as DataSourceContext;

describe("callable config-var factories", () => {
  it("references its own published component without creating an inline connection", () => {
    const api = connection({
      key: "api",
      display,
      inputs: { token: input({ label: "Token", type: "password" }) },
    });
    const server = component({ key: "published", public: true, display, connections: [api] });
    const fixture = callableComponent(server);
    expect(Array.isArray(server.connections[0].inputs)).toBe(true);
    expect(() => callableComponent({ connections: [api, api] })).toThrow(
      "Duplicate connection key",
    );
    const cni = integration({
      name: "Connection",
      flows: [],
      configPages: {
        Configuration: configPage({
          elements: {
            Connection: fixture.connections.api({
              stableKey: "connection",
              values: { token: { value: "default", writeOnly: true } },
            }),
          },
        }),
      },
    });
    expect(cni.connections).toEqual([]);
    const definition = parse(cni.codeNativeIntegrationYAML ?? "");
    expect(definition.requiredConfigVars[0]).toMatchObject({
      connection: {
        key: "api",
        component: { key: "published", signature, isPublic: true },
      },
      inputs: { token: { type: "value", value: "default", meta: { writeOnly: true } } },
    });
  });

  it.each([2, "LATEST", undefined])("ignores an explicit version override (%s)", (version) => {
    const fixture = callableComponent(
      component({
        key: "published",
        display,
        connections: [connection({ key: "api", display, inputs: {} })],
      }),
    );
    const options = { stableKey: "connection", version };
    const config = fixture.connections.api(options as any);
    expect(config).not.toHaveProperty("version");
    expect(options).toHaveProperty("version", version);
    const cni = integration({
      name: "Connection override",
      flows: [],
      configPages: { Configuration: configPage({ elements: { Connection: config } }) },
    });
    const definition = parse(cni.codeNativeIntegrationYAML ?? "");
    expect(definition.requiredConfigVars[0].connection.component).toEqual({
      key: "published",
      isPublic: false,
      signature,
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
          inputs: { ...inputs, filter: input({ label: "Filter", type: "string" }) },
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
    const ordinary = {
      ...dataSourceConfigVar({
        stableKey: "ordinary",
        dataSourceType: "jsonForm",
        perform: async () => ({ result: { schema: {}, uiSchema: { type: "VerticalLayout" } } }),
      }),
      dataSourceReset: { mode: "always" as const, dependencies: ["Query"] },
    };
    const cni = integration({
      name: "Data source factory",
      flows: [],
      configPages: {
        Configuration: configPage({
          elements: {
            "Ordinary Form": ordinary,
            Objects: fixture.dataSources.objects({
              stableKey: "objects",
              values: {
                connection: { configVar: "Connection" },
                query: { configVar: "Query" },
                filter: { configVar: "Parent" },
              },
            }),
          },
        }),
      },
    });
    expect(cni.dataSources.ordinaryForm).toMatchObject({
      display: { label: "Ordinary Form" },
      inputs: [{ key: "input0", label: "Query", type: "string" }],
    });
    expect(cni.dataSources.objects.detailDataSource).toBe("objects__detail");
    expect(cni.dataSources.objects__detail.inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "selected", type: "dynamicObjectSelection" }),
      ]),
    );
    const definition = parse(cni.codeNativeIntegrationYAML ?? "");
    const objects = definition.requiredConfigVars.find(
      (item: { key: string }) => item.key === "Objects",
    );
    expect(objects.inputs).toMatchObject({
      connection: { type: "configVar", value: "Connection" },
      query: { type: "configVar", value: "Query" },
    });
    expect(objects.dataSource.component.key).toBe(cni.key);
    await expect(cni.dataSources.objects.perform(context, {})).resolves.toEqual({
      result: [{ object: { key: "raw" } }],
    });
    await expect(
      cni.dataSources.objects__detail.perform(
        { ...context, configVars: { Connection: context.configVars.Connection, Query: " raw " } },
        { selected: "chosen", query: " override " },
      ),
    ).resolves.toEqual({ result: "override:chosen" });
    expect(clean).toHaveBeenCalledTimes(2);
    await expect(
      cni.dataSources.objects.perform({ ...context, configVars: {} }, {}),
    ).rejects.toThrow("Missing config variable for data source input");
    expect(() =>
      integration({
        name: "Colliding data sources",
        flows: [],
        configPages: {
          Configuration: configPage({
            elements: {
              "Ordinary Form": ordinary,
              "ordinary-form": fixture.dataSources.objects({
                stableKey: "collision",
                values: {
                  connection: { configVar: "Connection" },
                  query: "query",
                },
              }),
            },
          }),
        },
      }),
    ).toThrow("Bundled data source key collision");
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
