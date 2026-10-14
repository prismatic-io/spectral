import { describe, expect, it } from "vitest";
import { applyCodemod } from "../../testing";
import integrationConfiguration from "./integrationConfiguration";

const run = (files: Record<string, string>) => applyCodemod(integrationConfiguration, files);

const INDEX = `
import { configPage, configVar, integration } from "@prismatic-io/spectral";
import flows from "./flows";

export default integration({
  name: "Scheduled",
  flows,
  configPages: {
    Settings: configPage({
      elements: {
        region: configVar({ stableKey: "region", dataType: "string" }),
        "Sync Schedule": configVar({ stableKey: "sync-schedule", dataType: "schedule" }),
      },
    }),
  },
});
`;

const schemaOf = (index: string): string =>
  index.slice(
    index.indexOf("export const configPagesSchema"),
    index.indexOf("export const configurationSchema"),
  );

describe("v10.0.0/integration-configuration flow schedules", () => {
  it("takes a flow's config var schedule from the deploying user", () => {
    const { files, changed } = run({
      "src/index.ts": INDEX,
      "src/flows.ts": `
import { flow } from "@prismatic-io/spectral";

export default [
  flow({
    name: "Sync",
    stableKey: "sync",
    schedule: { configVar: "Sync Schedule", timezone: "America/Chicago" },
    onExecution: async () => ({ data: null }),
  }),
  flow({
    name: "Hourly",
    stableKey: "hourly",
    schedule: { value: "0 * * * *", timezone: "UTC" },
    onExecution: async () => ({ data: null }),
  }),
];
`,
    });

    expect(files["src/flows.ts"]).toContain(`    schedule: { fromDeployer: true },
    onExecution`);
    expect(files["src/flows.ts"]).toContain(`schedule: { value: "0 * * * *", timezone: "UTC" }`);
    expect(changed).toContain("src/flows.ts");
    // Nothing else read the schedule config var, so it is not part of the configuration.
    expect(schemaOf(files["src/index.ts"])).toBe(
      "export const configPagesSchema = z.object({\n  region: z.string(),\n});\n",
    );
  });

  it("rewrites a schedule declared apart from its polling flow", () => {
    const { files } = run({
      "src/index.ts": INDEX,
      "src/flows.ts": `
import { flow } from "@prismatic-io/spectral";

const syncSchedule = { configVar: "Sync Schedule" };

export default [
  flow({
    name: "Poll",
    stableKey: "poll",
    triggerType: "polling",
    schedule: syncSchedule,
    onTrigger: async (_context, payload) => ({ payload }),
    onExecution: async () => ({ data: null }),
  }),
];
`,
    });

    expect(files["src/flows.ts"]).toContain("const syncSchedule = { fromDeployer: true };");
    expect(files["src/flows.ts"]).toContain("    schedule: syncSchedule,");
  });

  it("flags flows that shared one schedule config var", () => {
    const { files } = run({
      "src/index.ts": INDEX,
      "src/flows.ts": `
export default [
  {
    name: "First",
    stableKey: "first",
    schedule: { configVar: "Sync Schedule" },
    onExecution: async () => ({ data: null }),
  },
  {
    name: "Second",
    stableKey: "second",
    schedule: { configVar: "Sync Schedule" },
    onExecution: async () => ({ data: null }),
  },
];
`,
    });

    const todo = `    // TODO: 2 flows read their schedule from the config var "Sync Schedule".
    // The deploying user now supplies a schedule for each flow.
    schedule: { fromDeployer: true },`;
    expect(files["src/flows.ts"].split(todo)).toHaveLength(3);
  });

  it("keeps a schedule config var that a flow also reads", () => {
    const { files } = run({
      "src/index.ts": INDEX,
      "src/flows.ts": `
import { flow } from "@prismatic-io/spectral";

export default [
  flow({
    name: "Sync",
    stableKey: "sync",
    schedule: { configVar: "Sync Schedule" },
    onExecution: async (context) => ({ data: context.configVars["Sync Schedule"] }),
  }),
];
`,
    });

    expect(files["src/flows.ts"]).toContain("schedule: { fromDeployer: true },");
    expect(files["src/flows.ts"]).toContain(`data: context.configuration?.["Sync Schedule"]`);
    expect(schemaOf(files["src/index.ts"])).toContain(`"Sync Schedule": z.object(`);
  });

  it("flags a schedule that reads a config var the integration does not declare", () => {
    const { files } = run({
      "src/index.ts": INDEX,
      "src/flows.ts": `
import { flow } from "@prismatic-io/spectral";

export default [
  flow({
    name: "Sync",
    stableKey: "sync",
    schedule: { configVar: "Missing Schedule" },
    onExecution: async () => ({ data: null }),
  }),
];
`,
    });

    expect(
      files["src/flows.ts"],
    ).toContain(`    // TODO: An integration with a configuration has no config vars, so this schedule
    // cannot read one. Use a fixed { value } or { fromDeployer: true }.
    schedule: { configVar: "Missing Schedule" },`);
  });

  it("leaves a schedule input of a component trigger alone", () => {
    const { files } = run({
      "src/index.ts": INDEX,
      "src/flows.ts": `
import { flow } from "@prismatic-io/spectral";

export default [
  flow({
    name: "Sync",
    stableKey: "sync",
    onTrigger: {
      component: "schedule-triggers",
      key: "schedule",
      values: { schedule: { configVar: "Sync Schedule" } },
    },
    onExecution: async () => ({ data: null }),
  }),
];
`,
    });

    expect(files["src/flows.ts"]).toContain(
      `values: { schedule: { configVar: "Sync Schedule" } },`,
    );
    expect(schemaOf(files["src/index.ts"])).toContain(`"Sync Schedule": z.object(`);
  });

  it("drops a flow test's value for a schedule the deploying user now supplies", () => {
    const { files } = run({
      "src/index.ts": INDEX,
      "src/flows.ts": `
import { flow } from "@prismatic-io/spectral";

export default [
  flow({
    name: "Sync",
    stableKey: "sync",
    schedule: { configVar: "Sync Schedule" },
    onExecution: async () => ({ data: null }),
  }),
];
`,
      "src/flows.test.ts": `
import { invokeFlow } from "@prismatic-io/spectral/dist/testing";
import flows from "./flows";

export const run = () =>
  invokeFlow(flows[0], { configVars: { region: "us", "Sync Schedule": "0 * * * *" } });
`,
    });

    expect(files["src/flows.test.ts"]).toContain(`configuration: {
      region: "us",
    }`);
    expect(files["src/flows.test.ts"]).not.toContain("Sync Schedule");
  });
});
