import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { OutputSchema } from "../../types/OutputSchema";
import type { ComponentForManifest } from "../cniComponentManifest/types";
import { createActions } from "./createActions";

const sourceDir = path.join(__dirname, "templates");

const buildComponent = (
  actionOverrides: Record<string, unknown> = {},
): ComponentForManifest<any, any> =>
  ({
    key: "acme",
    public: false,
    display: { label: "Acme", description: "Acme", iconPath: "icon.png" },
    connections: [],
    actions: {
      doThing: {
        key: "doThing",
        display: { label: "Do Thing", description: "Does the thing" },
        inputs: [],
        perform: async () => ({ data: {} }),
        ...actionOverrides,
      },
    },
    triggers: {},
    dataSources: {},
  }) as unknown as ComponentForManifest<any, any>;

describe("createActions outputSchema emission", () => {
  let destinationDir: string;

  beforeEach(async () => {
    destinationDir = await mkdtemp(path.join(tmpdir(), "spectral-create-actions-"));
  });

  afterEach(async () => {
    await rm(destinationDir, { recursive: true, force: true });
  });

  const render = async (actionOverrides: Record<string, unknown> = {}): Promise<string> => {
    await createActions({
      component: buildComponent(actionOverrides),
      dryRun: false,
      verbose: false,
      sourceDir,
      destinationDir,
    });
    return readFile(path.join(destinationDir, "actions", "doThing.ts"), "utf-8");
  };

  test("emits an actionOutput outputSchema", async () => {
    const outputSchema: OutputSchema = {
      type: "actionOutput",
      schema: { type: "object", properties: { id: { type: "string" } } },
    };
    const rendered = await render({ outputSchema });
    expect(rendered).toContain("outputSchema:");
    expect(rendered).toContain('type: "actionOutput"');
    expect(rendered).toContain("id:");
  });

  test("emits a branchingOutput outputSchema keyed by branchSchemas", async () => {
    const outputSchema: OutputSchema = {
      type: "branchingOutput",
      branchSchemas: {
        found: { type: "object" },
        notFound: { type: "object" },
      },
    };
    const rendered = await render({ outputSchema });
    expect(rendered).toContain("outputSchema:");
    expect(rendered).toContain('type: "branchingOutput"');
    expect(rendered).toContain("branchSchemas:");
    expect(rendered).toContain("found:");
    expect(rendered).toContain("notFound:");
  });

  test("omits outputSchema when the action declares none", async () => {
    const rendered = await render();
    expect(rendered).not.toContain("outputSchema:");
  });
});
