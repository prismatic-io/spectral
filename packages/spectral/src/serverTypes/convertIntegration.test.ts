import { describe, expect, it } from "vitest";
import { configPage, configVar, flow, integration } from "..";
import {
  convertConfigPages,
  convertFlow,
  convertConfigVar,
  convertQueueConfig,
} from "./convertIntegration";
import { ConfigVar } from "../types";

describe("convertFlow with polling triggers", () => {
  const baseFlowInput = {
    name: "Test Polling Flow",
    stableKey: "test-polling-flow",
    description: "A flow with polling trigger",
    onExecution: async () => ({ data: "test" }),
  };

  it("throws error when polling trigger has no schedule", () => {
    const pollingFlowWithoutSchedule = {
      ...baseFlowInput,
      triggerType: "polling" as const,
      onTrigger: async (_context: unknown, payload: { body: { data: string } }) => {
        return { payload };
      },
    };
    // @ts-expect-error - intentionally omitting schedule to test runtime validation
    expect(() => convertFlow(pollingFlowWithoutSchedule, {}, "test-ref")).toThrow(
      "Test Polling Flow is marked as a polling trigger but has no schedule. Polling triggers require a schedule.",
    );
  });

  it("converts polling flow with schedule successfully", () => {
    const pollingFlow = flow({
      ...baseFlowInput,
      triggerType: "polling",
      schedule: { value: "*/5 * * * *" },
      onTrigger: async (_context, payload) => {
        return { payload };
      },
    });

    const result = convertFlow(pollingFlow, {}, "test-ref");

    expect(result.name).toBe("Test Polling Flow");
    expect(result.stableKey).toBe("test-polling-flow");
  });

  it("converts flow with no explicit triggerType (defaults to standard)", () => {
    const defaultFlow = flow({
      ...baseFlowInput,
      onTrigger: async (_context, payload) => {
        return { payload };
      },
    });

    const result = convertFlow(defaultFlow, {}, "test-ref");

    expect(result.name).toBe("Test Polling Flow");
  });
});

describe("convertConfigPages", () => {
  it("should handle HTML string elements correctly", () => {
    const pages = {
      Connections: configPage({
        elements: {
          Authentication: "<h1>Authentication</h1>",
        },
      }),
    };

    const result = convertConfigPages(pages, false);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Connections");
    expect(result[0].elements).toHaveLength(1);
    expect(result[0].elements[0]).toEqual({
      type: "htmlElement",
      value: "<h1>Authentication</h1>",
    });
  });

  it("should handle mixed HTML and configVar elements", () => {
    const pages = {
      TestPage: configPage({
        tagline: "Test configuration page",
        elements: {
          HeaderText: "<h2>Configuration Settings</h2>",
          ApiKey: configVar({
            stableKey: "api-key",
            dataType: "string",
            description: "Your API key",
          }),
          Instructions: "<p>Enter your details below</p>",
        },
      }),
    };

    const result = convertConfigPages(pages, false);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("TestPage");
    expect(result[0].tagline).toBe("Test configuration page");
    expect(result[0].elements).toHaveLength(3);

    // Check HTML elements
    const htmlElements = result[0].elements.filter((el) => el.type === "htmlElement");
    expect(htmlElements).toHaveLength(2);
    expect(htmlElements[0].value).toBe("<h2>Configuration Settings</h2>");
    expect(htmlElements[1].value).toBe("<p>Enter your details below</p>");

    // Check configVar element
    const configVarElements = result[0].elements.filter((el) => el.type === "configVar");
    expect(configVarElements).toHaveLength(1);
    expect(configVarElements[0].value).toBe("ApiKey");
  });

  it("should handle configVar with htmlElement dataType", () => {
    const pages = {
      TestPage: configPage({
        elements: {
          CustomHTML: {
            dataType: "htmlElement",
            stableKey: "custom-html",
          },
        },
      }),
    };

    const result = convertConfigPages(pages, false);

    expect(result).toHaveLength(1);
    expect(result[0].elements).toHaveLength(1);
    expect(result[0].elements[0]).toEqual({
      type: "htmlElement",
      value: "CustomHTML", // Uses the key as the value
    });
  });

  it("should handle empty elements object", () => {
    const pages = {
      EmptyPage: configPage({
        elements: {},
      }),
    };

    const result = convertConfigPages(pages, false);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("EmptyPage");
    expect(result[0].elements).toHaveLength(0);
  });
});

describe("convertConfigVar", () => {
  const referenceKey = "test-component";
  const componentRegistry = {};

  describe("onPremConnectionConfig validation", () => {
    it("should return onPremiseConnectionConfig when connection has onPremControlled inputs and config set", () => {
      const connectionConfigVar = {
        stableKey: "test-connection",
        dataType: "connection",
        onPremConnectionConfig: "allowed",
        inputs: {
          host: {
            label: "Host",
            type: "string",
            onPremControlled: true,
          },
          port: {
            label: "Port",
            type: "string",
            onPremControlled: true,
          },
        },
      } as ConfigVar;

      const result = convertConfigVar(
        "TestConnection",
        connectionConfigVar,
        referenceKey,
        componentRegistry,
      );
      expect("onPremiseConnectionConfig" in result && result.onPremiseConnectionConfig).toBe(
        "allowed",
      );
    });

    it("should throw when connection has onPremControlled inputs but no onPremConnectionConfig", () => {
      const connectionConfigVar = {
        stableKey: "test-connection",
        dataType: "connection",
        inputs: {
          host: {
            label: "Host",
            type: "string",
            onPremControlled: true,
          },
          port: {
            label: "Port",
            type: "string",
            onPremControlled: true,
          },
        },
      } as ConfigVar;

      expect(() =>
        convertConfigVar("TestConnection", connectionConfigVar, referenceKey, componentRegistry),
      ).toThrow(
        "Connection test-connection has onPremControlled inputs but no onPremConnectionConfig value set",
      );
    });

    it("should default to 'disallowed' when connection has no onPremControlled inputs and no config", () => {
      const connectionConfigVar = {
        stableKey: "test-connection",
        dataType: "connection",
        inputs: {
          apiKey: {
            label: "API Key",
            type: "string",
          },
        },
      } as ConfigVar;

      const result = convertConfigVar(
        "TestConnection",
        connectionConfigVar,
        referenceKey,
        componentRegistry,
      );
      expect("onPremiseConnectionConfig" in result && result.onPremiseConnectionConfig).toBe(
        "disallowed",
      );
    });

    it("should allow 'disallowed' config when connection has no onPremControlled inputs", () => {
      const connectionConfigVar = {
        stableKey: "test-connection",
        dataType: "connection",
        onPremConnectionConfig: "disallowed",
        inputs: {
          apiKey: {
            label: "API Key",
            type: "string",
          },
        },
      } as ConfigVar;

      const result = convertConfigVar(
        "TestConnection",
        connectionConfigVar,
        referenceKey,
        componentRegistry,
      );
      expect("onPremiseConnectionConfig" in result && result.onPremiseConnectionConfig).toBe(
        "disallowed",
      );
    });

    it("should throw when connection has defined config but no onPremControlled inputs", () => {
      const connectionConfigVar = {
        stableKey: "test-connection",
        dataType: "connection",
        onPremConnectionConfig: "allowed",
        inputs: {
          apiKey: {
            label: "API Key",
            type: "string",
          },
        },
      } as ConfigVar;

      expect(() =>
        convertConfigVar("TestConnection", connectionConfigVar, referenceKey, componentRegistry),
      ).toThrow(
        "Connection test-connection has onPremConnectionConfig set but no onPremControlled inputs",
      );
    });
  });
});

describe("convertQueueConfig", () => {
  describe("parallel queue config", () => {
    it("converts to usesFifoQueue: false", () => {
      const input = { type: "parallel" as const };
      const result = convertQueueConfig(input);

      expect(result.usesFifoQueue).toBe(false);
    });
  });

  describe("throttled queue config", () => {
    it("converts to usesFifoQueue: true with concurrencyLimit", () => {
      const input = {
        type: "throttled" as const,
        concurrencyLimit: 5,
      };
      const result = convertQueueConfig(input);

      expect(result.usesFifoQueue).toBe(true);
      expect(result.concurrencyLimit).toBe(5);
    });

    it("preserves dedupeIdField", () => {
      const input = {
        type: "throttled" as const,
        concurrencyLimit: 3,
        dedupeIdField: "requestId",
      };
      const result = convertQueueConfig(input);

      expect(result.usesFifoQueue).toBe(true);
      expect(result.concurrencyLimit).toBe(3);
      expect(result.dedupeIdField).toBe("requestId");
    });
  });

  describe("sequential queue config", () => {
    it("converts to usesFifoQueue: true (processes one at a time)", () => {
      const input = { type: "sequential" as const };
      const result = convertQueueConfig(input);

      expect(result.usesFifoQueue).toBe(true);
      expect(result.concurrencyLimit).toBeUndefined();
    });

    it("preserves dedupeIdField", () => {
      const input = {
        type: "sequential" as const,
        dedupeIdField: "orderId",
      };
      const result = convertQueueConfig(input);

      expect(result.usesFifoQueue).toBe(true);
      expect(result.dedupeIdField).toBe("orderId");
    });
  });

  describe("legacy StandardQueueConfig", () => {
    it("passes through unchanged when no type property", () => {
      const input = {
        usesFifoQueue: true,
        concurrencyLimit: 4,
        dedupeIdField: "myField",
      };
      const result = convertQueueConfig(input);

      expect(result).toEqual(input);
    });

    it("passes through singletonExecutions config", () => {
      const input = {
        usesFifoQueue: false,
        singletonExecutions: true,
      };
      const result = convertQueueConfig(input);

      expect(result).toEqual(input);
    });
  });
});

describe("webhookLifecycleHandlers", () => {
  const mockWebhookCreate = async () => {};
  const mockWebhookDelete = async () => {};

  it("strips webhookLifecycleHandlers from convertFlow output", () => {
    const testFlow = flow({
      name: "Webhook Flow",
      stableKey: "webhook-flow",
      description: "Flow with webhook lifecycle handlers",
      onExecution: async () => ({ data: "test" }),
      webhookLifecycleHandlers: {
        create: mockWebhookCreate,
        delete: mockWebhookDelete,
      },
    });

    const result = convertFlow(testFlow, {}, "test-ref");

    expect(result.webhookLifecycleHandlers).toBeUndefined();
  });

  it("creates trigger functions and generates valid YAML", () => {
    const testIntegration = integration({
      name: "test-webhook-integration",
      description: "Test integration with webhook handlers",
      flows: [
        flow({
          name: "Webhook Flow",
          stableKey: "webhook-flow",
          description: "Flow with webhook lifecycle handlers",
          onTrigger: async (_context, payload) => ({ payload }),
          onExecution: async () => ({ data: "test" }),
          webhookLifecycleHandlers: {
            create: mockWebhookCreate,
            delete: mockWebhookDelete,
          },
        }),
      ],
    });

    const trigger = testIntegration.triggers.webhookFlow_onTrigger;
    expect(trigger.hasWebhookCreateFunction).toBe(true);
    expect(trigger.hasWebhookDeleteFunction).toBe(true);
    expect(trigger.webhookCreate).toBeInstanceOf(Function);
    expect(trigger.webhookDelete).toBeInstanceOf(Function);

    expect(testIntegration.codeNativeIntegrationYAML).not.toContain("webhookLifecycleHandlers");
  });
});
