import path from "path";

import { type Input, getInputs } from "./getInputs";
import { type Imports, getImports } from "./getImports";
import { helpers } from "./helpers";
import { createTemplate } from "../utils/createTemplate";
import type { Component } from "../../serverTypes";

interface CreateTriggersProps {
  component: Component;
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const createTriggers = async ({
  component,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: CreateTriggersProps) => {
  if (verbose) {
    console.info("Creating triggers...");
  }

  const triggersIndex = await renderTriggersIndex({
    triggers: Object.entries(component.triggers ?? {}).map(([triggerKey, trigger]) => {
      return {
        key: trigger.key || triggerKey,
      };
    }),
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
  });

  const triggers = await Promise.all(
    Object.entries(component.triggers ?? {}).map(async ([triggerKey, trigger]) => {
      const inputs = getInputs({
        inputs: trigger.inputs,
      });

      const imports = getImports({ inputs });

      return await renderTrigger({
        trigger: {
          key: trigger.key || triggerKey,
          label: trigger.display.description,
          description: trigger.display.description,
          inputs,
        },
        dryRun,
        imports,
        verbose,
        sourceDir,
        destinationDir,
      });
    }),
  );

  if (verbose) {
    console.info("");
  }

  return Promise.resolve({
    triggersIndex,
    triggers,
  });
};

interface RenderTriggersIndexProps {
  triggers: {
    key: string;
  }[];
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

const renderTriggersIndex = async ({
  triggers,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: RenderTriggersIndexProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "triggers", "index.ts.ejs"),
    destination: path.join(destinationDir, "triggers", "index.ts"),
    data: {
      triggers,
    },
    dryRun,
    verbose,
  });
};

interface RenderTriggerProps {
  trigger: {
    key: string;
    label: string;
    description: string;
    inputs: Input[];
  };
  dryRun: boolean;
  imports: Imports;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

const renderTrigger = async ({
  dryRun,
  imports,
  trigger,
  verbose,
  sourceDir,
  destinationDir,
}: RenderTriggerProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "triggers", "trigger.ts.ejs"),
    destination: path.join(destinationDir, "triggers", `${trigger.key}.ts`),
    data: {
      helpers,
      imports,
      trigger,
    },
    dryRun,
    verbose,
  });
};
