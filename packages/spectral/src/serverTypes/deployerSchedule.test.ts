import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { configPage, configuration, configVar, flow, integration } from "..";
import type { IntegrationDefinition, TriggerPayload, TriggerReference } from "../types";
import { convertFlow } from "./convertIntegration";

/**
 * A headless integration (one that defines `configuration`) has no config variables, so a
 * flow's schedule is a fixed value or is supplied by the deploying user. The platform reads
 * `fromDeployer` from the trigger step's `schedule`.
 */

const headlessConfiguration = configuration({
  instance: {
    schema: { type: "object", properties: {}, additionalProperties: false },
    version: "v1",
  },
});

const baseFlowInput = {
  name: "Deployer Scheduled Flow",
  stableKey: "deployer-scheduled-flow",
  description: "Runs on the schedule the deploying user supplies",
  onExecution: async () => ({ data: "done" }),
};

const deployerSchedule = { fromDeployer: true } as const;

const onTrigger = async (_context: unknown, payload: TriggerPayload) => ({ payload });

const triggerStepOf = (converted: Record<string, unknown>) =>
  (converted.steps as Array<Record<string, unknown>>)[0];

const registry = {
  "acme-component": {
    key: "acme-component",
    public: true,
    signature: "sig-123",
    actions: {},
    triggers: { acmeTrigger: { key: "acmeTrigger", inputs: {} } },
    dataSources: {},
    connections: {},
  },
} as unknown as Parameters<typeof convertFlow>[1];

describe("a schedule from the deployer on the trigger step", () => {
  it("uses the schedule trigger when the flow has no onTrigger", () => {
    const converted = convertFlow(
      flow({ ...baseFlowInput, schedule: deployerSchedule }),
      {},
      "test-ref",
    );

    expect(triggerStepOf(converted)).toMatchObject({
      action: { key: "schedule", component: { key: "schedule-triggers", isPublic: true } },
    });
    expect(triggerStepOf(converted).schedule).toEqual({ fromDeployer: true });
  });

  it("keeps the wrapper trigger for an inline onTrigger function", () => {
    const converted = convertFlow(
      flow({ ...baseFlowInput, schedule: deployerSchedule, onTrigger }),
      {},
      "test-ref",
    );

    expect(triggerStepOf(converted)).toMatchObject({
      action: { component: { key: "test-ref", isPublic: false } },
    });
    expect(triggerStepOf(converted).schedule).toEqual({ fromDeployer: true });
  });

  it("keeps the referenced trigger for a component trigger reference", () => {
    const triggerReference = {
      component: "acme-component",
      key: "acmeTrigger",
      values: {},
    } as unknown as TriggerReference;

    const converted = convertFlow(
      flow({ ...baseFlowInput, schedule: deployerSchedule, onTrigger: triggerReference }),
      registry,
      "test-ref",
    );

    expect(triggerStepOf(converted)).toMatchObject({
      action: { key: "acmeTrigger", component: { key: "acme-component" } },
    });
    expect(triggerStepOf(converted).schedule).toEqual({ fromDeployer: true });
  });

  it("adds the schedule trigger component for a flow with lifecycle handlers and no onTrigger", () => {
    const converted = convertFlow(
      flow({
        ...baseFlowInput,
        schedule: deployerSchedule,
        onInstanceDeploy: async () => ({}),
      }),
      {},
      "test-ref",
    );

    expect(converted.supplementalComponents).toContainEqual({
      key: "schedule-triggers",
      isPublic: true,
      version: "LATEST",
    });
    expect(triggerStepOf(converted).schedule).toEqual({ fromDeployer: true });
  });

  it("satisfies a polling flow's required schedule", () => {
    const converted = convertFlow(
      flow({
        ...baseFlowInput,
        triggerType: "polling",
        schedule: deployerSchedule,
        onTrigger: async (_context, payload) => ({ payload }),
      }),
      {},
      "test-ref",
    );

    expect(triggerStepOf(converted).schedule).toEqual({ fromDeployer: true });
  });

  it("counts as a schedule for singleton executions", () => {
    expect(() =>
      convertFlow(
        flow({
          ...baseFlowInput,
          schedule: deployerSchedule,
          queueConfig: { singletonExecutions: true },
        }),
        {},
        "test-ref",
      ),
    ).not.toThrow();
  });

  it("counts as a schedule for the FIFO queue check", () => {
    expect(() =>
      convertFlow(
        flow({
          ...baseFlowInput,
          schedule: deployerSchedule,
          queueConfig: { usesFifoQueue: true },
        }),
        {},
        "test-ref",
      ),
    ).toThrow(
      "Deployer Scheduled Flow has a schedule & usesFifoQueue set to true. FIFO queues cannot be used with scheduled flows.",
    );
  });
});

describe("a headless integration's flow schedules", () => {
  const triggerSchedules = (definition: IntegrationDefinition) => {
    const { codeNativeIntegrationYAML } = integration(definition) as unknown as {
      codeNativeIntegrationYAML: string;
    };
    const { flows } = parse(codeNativeIntegrationYAML) as {
      flows: Array<{ steps: Array<{ schedule?: unknown }> }>;
    };
    return flows.map(({ steps }) => steps[0].schedule);
  };

  it("emits a schedule from the deployer and a fixed schedule", () => {
    expect(
      triggerSchedules({
        name: "Headless",
        configuration: headlessConfiguration,
        flows: [
          flow({ ...baseFlowInput, schedule: deployerSchedule }),
          flow({
            ...baseFlowInput,
            name: "Fixed Scheduled Flow",
            stableKey: "fixed-scheduled-flow",
            schedule: { value: "0 * * * *", timezone: "America/Chicago" },
          }),
        ],
      }),
    ).toEqual([
      { fromDeployer: true },
      {
        type: "value",
        value: "0 * * * *",
        meta: { scheduleType: "custom", timeZone: "America/Chicago" },
      },
    ]);
  });

  it("refuses a config variable schedule", () => {
    expect(() =>
      // @ts-expect-error a headless integration has no config variable for a schedule
      integration({
        name: "Headless",
        configuration: headlessConfiguration,
        flows: [flow({ ...baseFlowInput, schedule: { configVar: "Sync Schedule" } })],
      }),
    ).toThrow(
      "Deployer Scheduled Flow uses a config variable schedule, but an integration with `configuration` has no config variables. Use `{ value }` or `{ fromDeployer: true }`.",
    );
  });
});

describe("an integration with config pages", () => {
  it("refuses a schedule from the deployer", () => {
    expect(() =>
      // @ts-expect-error only a headless integration takes a schedule from the deployer
      integration({
        name: "Config Pages",
        configPages: {
          Schedule: configPage({
            elements: {
              "Sync Schedule": configVar({ stableKey: "sync-schedule", dataType: "schedule" }),
            },
          }),
        },
        flows: [flow({ ...baseFlowInput, schedule: deployerSchedule })],
      }),
    ).toThrow(
      "Deployer Scheduled Flow has a schedule from the deployer, which only an integration with `configuration` supports.",
    );
  });

  it("keeps a config variable schedule", () => {
    const { codeNativeIntegrationYAML } = integration({
      name: "Config Pages",
      configPages: {
        Schedule: configPage({
          elements: {
            "Sync Schedule": configVar({ stableKey: "sync-schedule", dataType: "schedule" }),
          },
        }),
      },
      flows: [flow({ ...baseFlowInput, schedule: { configVar: "Sync Schedule" } })],
    }) as unknown as { codeNativeIntegrationYAML: string };

    const { flows } = parse(codeNativeIntegrationYAML) as {
      flows: Array<{ steps: Array<{ schedule?: unknown }> }>;
    };
    expect(flows[0].steps[0].schedule).toEqual({
      type: "configVar",
      value: "Sync Schedule",
      meta: { scheduleType: "custom", timeZone: "" },
    });
  });
});
