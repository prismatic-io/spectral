import { describe, expect, it } from "vitest";
import { z } from "zod";
import { configuration, connectionConfigVar, integration, userActivatedConnection } from "..";
import { createConfigurationConnections, createConfigurationContext } from "./configurationContext";
import {
  convertConfigurationInit,
  convertIntegrationConfiguration,
} from "./convertIntegrationConfiguration";

const schema = z.object({});
const binding = { fields: { token: "secret" } };

describe("scoped configuration boundaries", () => {
  it("publishes custom UI metadata independently for both scopes", () => {
    const instanceUi = { type: "custom", value: { widget: "mapping", nested: [1, null] } } as const;
    const userUi = {
      type: "uiSchema",
      value: { type: "Control", scope: "#/properties/name" },
    } as const;
    const converted = convertIntegrationConfiguration({
      instance: { schema, version: "1", ui: instanceUi },
      userLevel: { schema, version: "1", ui: userUi },
    });

    expect(converted.configuration.instance.ui).toEqual(instanceUi);
    expect(converted.configuration.userLevel?.ui).toEqual(userUi);
  });

  it("publishes the current schema only once even when history repeats its version", () => {
    const current = { type: "object", properties: { name: { type: "string" } } } as const;
    const historical = { type: "object", properties: { id: { type: "number" } } } as const;
    const converted = convertIntegrationConfiguration({
      instance: {
        schema: current,
        version: "v2",
        versionSchemas: { v1: historical, v2: historical },
      },
      userLevel: {
        schema: current,
        version: "v2",
        versionSchemas: { v1: historical, v2: historical },
      },
    });

    for (const descriptor of [
      converted.configuration.instance,
      converted.configuration.userLevel,
    ]) {
      expect(descriptor?.schema).toEqual(current);
      expect(descriptor?.versionSchemas).toEqual({ v1: historical });
    }
  });

  it("treats dotted and prototype-like local names as literal keys", () => {
    const keys = ["instance.__proto__", "instance.constructor", "userLevel.a.b"];
    const values = Object.fromEntries(keys.map((key) => [key, binding]));
    const names = Object.fromEntries(keys.map((key) => [key, key]));
    const connections = createConfigurationConnections(names, {
      ...values,
      "instance.unrelated": binding,
      "__proto__.polluted": binding,
    });
    expect(Object.keys(connections.instance)).toEqual(["__proto__", "constructor"]);
    expect(connections.instance.__proto__).toBe(binding);
    expect(connections.instance.constructor).toBe(binding);
    expect(connections.userLevel["a.b"]).toBe(binding);
    expect(connections.userLevel.a).toBeUndefined();
    expect(Object.getPrototypeOf(connections.instance)).toBeNull();
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });

  it("does not read inherited config vars or expand unrelated dotted values", () => {
    const bag = Object.create({ "instance.airtable": binding });
    bag["userLevel.other"] = binding;
    expect(
      createConfigurationConnections({ "instance.airtable": "instance.airtable" }, bag),
    ).toEqual({});
  });

  it("uses explicit invocation bindings before CNI config vars, including an empty binding set", () => {
    const names = { "instance.airtable": "instance.airtable" };
    const configVars = { "instance.airtable": binding };
    expect(createConfigurationContext({ configVars }, names).connections.instance.airtable).toBe(
      binding,
    );
    expect(createConfigurationContext({ configVars, connections: {} }, names).connections).toEqual(
      {},
    );
  });

  it("initializes without a scope discriminator", async () => {
    const perform = convertConfigurationInit(async (context) => context);
    await expect(perform({})).resolves.toMatchObject({
      configurationVersion: null,
      configuration: {},
      userConfiguration: {},
    });
  });

  it("rejects empty local names and wrong-scope dependencies before invocation", () => {
    expect(() =>
      convertIntegrationConfiguration({
        instance: {
          schema,
          version: "1",
          connections: { "": { stableKey: "empty", dataType: "connection" } },
        },
      }),
    ).toThrow("must not be empty");
    expect(() =>
      convertIntegrationConfiguration({
        instance: { schema, version: "1" },
        userLevel: {
          schema,
          version: "1",
          connections: { airtable: userActivatedConnection({ stableKey: "user" }) },
        },
        init: { connections: ["instance.airtable"], perform: async () => null },
      }),
    ).toThrow('Undeclared configuration connection: "instance.airtable"');
  });

  it("rejects colliding generated component keys without changing the qualified RCV keys", () => {
    const inline = (stableKey: string) =>
      connectionConfigVar({
        stableKey,
        dataType: "connection",
        inputs: { token: { label: "Token", type: "password" } },
      });
    const definition = configuration({
      instance: {
        schema,
        version: "1",
        connections: { "api-key": inline("one"), apiKey: inline("two") },
      },
    });
    expect(() =>
      integration({ name: "Collision", flows: [], configuration: definition } as never),
    ).toThrow("Generated connection key collision");
  });
});
