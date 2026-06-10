import { describe, expect, it } from "vitest";
import { configPage, configVar, flow, integration } from "..";
import type { ConfigVar } from "../types";
import {
  convertConfigPages,
  convertConfigVar,
  convertFlow,
  convertQueueConfig,
} from "./convertIntegration";

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

  it("emits triggerResolver { batchSize } and strips resolveItems on the flow result", () => {
    const triggerResolverFlow = flow({
      ...baseFlowInput,
      onTrigger: async (_context, payload) => ({ payload }),
      triggerResolver: {
        batchSize: 25,
        resolveItems: () => [1, 2, 3],
      },
    });

    const result = convertFlow(triggerResolverFlow, {}, "test-ref");

    expect(result.triggerResolver).toEqual({ batchSize: 25 });
  });

  it("throws when flow-level triggerResolver batchSize is invalid", () => {
    const invalidFlow = flow({
      ...baseFlowInput,
      onTrigger: async (_context, payload) => ({ payload }),
      // @ts-expect-error - intentionally invalid batchSize for runtime validation
      triggerResolver: { batchSize: 0 },
    });

    expect(() => convertFlow(invalidFlow, {}, "test-ref")).toThrow(
      /invalid triggerResolver batchSize of 0/,
    );
  });

  it("emits onDeployResolver { batchSize } and strips resolveItems on the flow result", () => {
    const onDeployFlow = flow({
      ...baseFlowInput,
      onTrigger: async (_context, payload) => ({ payload }),
      onDeployTrigger: async (_context, payload) => ({ payload }),
      onDeployResolver: {
        batchSize: 50,
        resolveItems: () => [1, 2, 3],
      },
    });

    const result = convertFlow(onDeployFlow, {}, "test-ref");

    expect(result.onDeployResolver).toEqual({ batchSize: 50 });
  });

  it("throws when flow-level onDeployResolver batchSize is invalid", () => {
    const invalidFlow = flow({
      ...baseFlowInput,
      onTrigger: async (_context, payload) => ({ payload }),
      onDeployTrigger: async (_context, payload) => ({ payload }),
      // @ts-expect-error - intentionally invalid batchSize for runtime validation
      onDeployResolver: { batchSize: 0 },
    });

    expect(() => convertFlow(invalidFlow, {}, "test-ref")).toThrow(
      /invalid onDeployResolver batchSize of 0/,
    );
  });

  it("throws when flow-level onDeployResolver is set without onDeployTrigger", () => {
    const invalidFlow = flow({
      ...baseFlowInput,
      onTrigger: async (_context, payload) => ({ payload }),
      onDeployResolver: { batchSize: 10 },
    });

    expect(() => convertFlow(invalidFlow, {}, "test-ref")).toThrow(
      /declares onDeployResolver without onDeployTrigger/,
    );
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

  describe("schedule config var handling", () => {
    // In low-code, schedule-typed config variables can have a default of
    // "Never" (scheduleType "none"), "Minute", "Hour", "Day", "Week", or
    // "Custom" (a CRON expression). CNI should support the same set of
    // defaults rather than always forcing scheduleType to "custom".

    it("should default to scheduleType 'none' when no defaultValue is provided (Never)", () => {
      const scheduleConfigVar = configVar({
        stableKey: "test-schedule",
        dataType: "schedule",
      });

      const result = convertConfigVar(
        "TestSchedule",
        scheduleConfigVar,
        referenceKey,
        componentRegistry,
      );

      expect("scheduleType" in result && result.scheduleType).toBe("none");
      expect("defaultValue" in result && result.defaultValue).toBeUndefined();
    });

    it("should treat an empty-string defaultValue as the 'Never' schedule (scheduleType 'none')", () => {
      const scheduleConfigVar = configVar({
        stableKey: "test-schedule",
        dataType: "schedule",
        defaultValue: "",
      });

      const result = convertConfigVar(
        "TestSchedule",
        scheduleConfigVar,
        referenceKey,
        componentRegistry,
      );

      expect("scheduleType" in result && result.scheduleType).toBe("none");
    });

    it("should set scheduleType to 'custom' when a CRON expression is provided as defaultValue", () => {
      const scheduleConfigVar = configVar({
        stableKey: "test-schedule",
        dataType: "schedule",
        defaultValue: "*/5 * * * *",
      });

      const result = convertConfigVar(
        "TestSchedule",
        scheduleConfigVar,
        referenceKey,
        componentRegistry,
      );

      expect("scheduleType" in result && result.scheduleType).toBe("custom");
      expect("defaultValue" in result && result.defaultValue).toBe("*/5 * * * *");
    });

    it("should respect a user-specified scheduleType (e.g. 'hour')", () => {
      const scheduleConfigVar = configVar({
        stableKey: "test-schedule",
        dataType: "schedule",
        scheduleType: "hour",
      });

      const result = convertConfigVar(
        "TestSchedule",
        scheduleConfigVar,
        referenceKey,
        componentRegistry,
      );

      expect("scheduleType" in result && result.scheduleType).toBe("hour");
    });

    it("should respect a user-specified scheduleType of 'none' (Never)", () => {
      const scheduleConfigVar = configVar({
        stableKey: "test-schedule",
        dataType: "schedule",
        scheduleType: "none",
      });

      const result = convertConfigVar(
        "TestSchedule",
        scheduleConfigVar,
        referenceKey,
        componentRegistry,
      );

      expect("scheduleType" in result && result.scheduleType).toBe("none");
    });

    it("should preserve timeZone on schedule config vars", () => {
      const scheduleConfigVar = configVar({
        stableKey: "test-schedule",
        dataType: "schedule",
        timeZone: "America/Chicago",
      });

      const result = convertConfigVar(
        "TestSchedule",
        scheduleConfigVar,
        referenceKey,
        componentRegistry,
      );

      expect("timeZone" in result && result.timeZone).toBe("America/Chicago");
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

describe("convertFlow supplementalComponents", () => {
  const baseFlowInput = {
    name: "Test Flow",
    stableKey: "test-flow",
    description: "A test flow",
    onExecution: async () => ({ data: "test" }),
  };

  it("uses signature when component manifest has a non-null signature", () => {
    const registry = {
      "my-component": {
        key: "my-component",
        public: true,
        signature: "abc123",
        actions: {},
        triggers: {},
        dataSources: {},
        connections: {},
      },
    };

    const testFlow = flow({ ...baseFlowInput });
    const result = convertFlow(testFlow, registry, "test-ref");
    const supplemental = result.supplementalComponents as Array<Record<string, unknown>>;

    const component = supplemental.find((c) => c.key === "my-component");
    expect(component).toEqual({
      key: "my-component",
      isPublic: true,
      signature: "abc123",
    });
    expect(component).not.toHaveProperty("version");
  });

  it("falls back to version LATEST when component manifest has null signature", () => {
    const registry = {
      "my-component": {
        key: "my-component",
        public: true,
        signature: null,
        actions: {},
        triggers: {},
        dataSources: {},
        connections: {},
      },
    };

    const testFlow = flow({ ...baseFlowInput });
    const result = convertFlow(testFlow, registry, "test-ref");
    const supplemental = result.supplementalComponents as Array<Record<string, unknown>>;

    const component = supplemental.find((c) => c.key === "my-component");
    expect(component).toEqual({
      key: "my-component",
      isPublic: true,
      version: "LATEST",
    });
    expect(component).not.toHaveProperty("signature");
  });

  it("does not produce an empty string signature", () => {
    const registry = {
      "my-component": {
        key: "my-component",
        public: true,
        signature: null,
        actions: {},
        triggers: {},
        dataSources: {},
        connections: {},
      },
    };

    const testFlow = flow({ ...baseFlowInput });
    const result = convertFlow(testFlow, registry, "test-ref");
    const supplemental = result.supplementalComponents as Array<Record<string, unknown>>;

    const component = supplemental.find((c) => c.key === "my-component");
    expect(component?.signature).not.toBe("");
  });
});
