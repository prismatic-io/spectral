import type { TriggerPayload } from "@prismatic-io/spectral";
import { configuration, flow, integration } from "@prismatic-io/spectral";

/**
 * A headless integration (one that defines `configuration`) has no config variables, so a
 * flow's schedule is a fixed value or is supplied by the deploying user. An integration with
 * config pages can read a schedule from a config variable, and has no deployer schedule.
 */

const headlessConfiguration = configuration({
  instance: {
    schema: { type: "object", properties: {}, additionalProperties: false },
    version: "v1",
  },
});

const baseFlow = {
  name: "Scheduled Flow",
  stableKey: "scheduled-flow",
  onExecution: async () => ({ data: "done" }),
};

const deployerScheduledFlow = flow({ ...baseFlow, schedule: { fromDeployer: true } });
const fixedScheduledFlow = flow({
  ...baseFlow,
  schedule: { value: "0 * * * *", timezone: "America/Chicago" },
});
const configVarScheduledFlow = flow({ ...baseFlow, schedule: { configVar: "Sync Schedule" } });
const deployerPollingFlow = flow({
  ...baseFlow,
  triggerType: "polling",
  schedule: { fromDeployer: true },
  onTrigger: async (_context, payload: TriggerPayload) => ({ payload }),
});

// A headless integration takes a fixed schedule or one from the deployer.
integration({
  name: "Headless",
  configuration: headlessConfiguration,
  flows: [deployerScheduledFlow, fixedScheduledFlow, deployerPollingFlow],
});

// A schedule from the deployer can be written inline.
integration({
  name: "Headless",
  configuration: headlessConfiguration,
  flows: [{ ...baseFlow, schedule: { fromDeployer: true } }],
});

// @ts-expect-error: a headless integration has no config variable for a schedule.
integration({
  name: "Headless",
  configuration: headlessConfiguration,
  flows: [configVarScheduledFlow],
});

// @ts-expect-error: a headless integration has no config variable for an inline schedule.
integration({
  name: "Headless",
  configuration: headlessConfiguration,
  flows: [{ ...baseFlow, schedule: { configVar: "Sync Schedule" } }],
});

// An integration with config pages takes a fixed schedule or a config variable.
integration({
  name: "Config Pages",
  flows: [fixedScheduledFlow, configVarScheduledFlow],
});

// @ts-expect-error: only a headless integration takes a schedule from the deployer.
integration({
  name: "Config Pages",
  flows: [deployerScheduledFlow],
});

// @ts-expect-error: the deploying user supplies the timezone with the schedule.
flow({ ...baseFlow, schedule: { fromDeployer: true, timezone: "UTC" } });

// @ts-expect-error: a fixed schedule is not also supplied by the deployer.
flow({ ...baseFlow, schedule: { value: "0 * * * *", fromDeployer: true } });

// @ts-expect-error: a schedule is a fixed value or a config variable, not both.
flow({ ...baseFlow, schedule: { value: "0 * * * *", configVar: "Sync Schedule" } });
