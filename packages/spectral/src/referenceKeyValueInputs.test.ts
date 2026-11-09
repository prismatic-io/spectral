import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { callableComponent, component, configPage, connection, input, integration } from ".";

const display = { label: "Regional API", description: "API routing configuration" };
const defaultRoutes = [{ key: "primary", value: "us-east" }];
const fixture = callableComponent(
  component({
    key: "regional-api",
    display: { ...display, iconPath: "icon.png" },
    connections: [
      connection({
        key: "api",
        display,
        inputs: {
          routes: input({
            label: "Routes",
            type: "string",
            collection: "keyvaluelist",
            default: defaultRoutes,
          }),
          region: input({ label: "Region", type: "string", default: "us-east" }),
          scopes: input({ label: "Scopes", type: "string", collection: "valuelist" }),
        },
      }),
    ],
  }),
);

describe("referenced connection key-value inputs", () => {
  it.each([
    { label: "record", value: { primary: "us-east", backup: "eu-west" } },
    {
      label: "array",
      value: [
        { key: "primary", value: "us-east" },
        { key: "backup", value: "eu-west" },
      ],
    },
  ])("preserves routing keys in integration YAML for a $label", ({ value }) => {
    const original = structuredClone(value);
    const cni = integration({
      name: "Regional API sync",
      flows: [],
      configPages: {
        Configuration: configPage({
          elements: {
            API: fixture.connections.api({
              stableKey: "api",
              values: {
                routes: { value, writeOnly: true },
                scopes: { value: ["read", "write"] },
              },
            }),
          },
        }),
      },
    });
    const definition = parse(cni.codeNativeIntegrationYAML ?? "");
    expect(definition.requiredConfigVars[0].inputs).toEqual({
      routes: {
        type: "complex",
        value: [
          { name: { type: "value", value: "primary" }, type: "value", value: '"us-east"' },
          { name: { type: "value", value: "backup" }, type: "value", value: '"eu-west"' },
        ],
        meta: {
          orgOnly: false,
          visibleToOrgDeployer: true,
          visibleToCustomerDeployer: true,
          writeOnly: true,
        },
      },
      region: {
        type: "value",
        value: "us-east",
        meta: { orgOnly: false, visibleToOrgDeployer: true, visibleToCustomerDeployer: true },
      },
      scopes: {
        type: "complex",
        value: [
          { type: "value", value: "read" },
          { type: "value", value: "write" },
        ],
        meta: { orgOnly: false, visibleToOrgDeployer: true, visibleToCustomerDeployer: true },
      },
    });
    expect(value).toEqual(original);
  });

  it("preserves array defaults and repeated keys in their authored order", () => {
    const routes = [
      { key: "priority", value: "first" },
      { key: "priority", value: "second" },
    ];
    const cni = integration({
      name: "Ordered routing",
      flows: [],
      configPages: {
        Configuration: configPage({
          elements: {
            Defaults: fixture.connections.api({ stableKey: "defaults" }),
            Ordered: fixture.connections.api({
              stableKey: "ordered",
              values: { routes: { value: routes } },
            }),
            Dynamic: fixture.connections.api({
              stableKey: "dynamic",
              values: { routes: { configVar: "Routes" } },
            }),
          },
        }),
      },
    });
    const definition = parse(cni.codeNativeIntegrationYAML ?? "");
    const [defaults, ordered, dynamic] = definition.requiredConfigVars;
    expect(defaults.inputs.routes.value).toEqual([
      { name: { type: "value", value: "primary" }, type: "value", value: '"us-east"' },
    ]);
    expect(ordered.inputs.routes.value).toEqual([
      { name: { type: "value", value: "priority" }, type: "value", value: '"first"' },
      { name: { type: "value", value: "priority" }, type: "value", value: '"second"' },
    ]);
    expect(dynamic.inputs.routes).toEqual({ type: "configVar", value: "Routes" });
    expect(defaultRoutes).toEqual([{ key: "primary", value: "us-east" }]);
    expect(routes).toEqual([
      { key: "priority", value: "first" },
      { key: "priority", value: "second" },
    ]);
  });

  it("rejects array entries that are not key-value pairs", () => {
    const build = () =>
      integration({
        name: "Malformed routing",
        flows: [],
        configPages: {
          Configuration: configPage({
            elements: {
              API: fixture.connections.api({
                stableKey: "api",
                values: { routes: { value: ["us-east"] as any } },
              }),
            },
          }),
        },
      }).codeNativeIntegrationYAML;
    expect(build).toThrow('Key-value list entries must be objects with a "key": "us-east"');
  });
});
