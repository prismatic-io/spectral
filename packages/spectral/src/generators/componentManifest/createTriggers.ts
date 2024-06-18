import path from "path";

import { DESTINATION_DIR, SOURCE_DIR } from "./constants";
import { Input, getInputs } from "./getInputs";
import { Imports, getImports } from "./getImports";
import { helpers } from "./helpers";
import { createTemplate } from "../utils/createTemplate";
import { Component, Input as ServerTypeInput } from "../../serverTypes";

const DOCUMENT_PROPERTIES: (keyof ServerTypeInput)[] = [
  "comments",
  "default",
  "example",
  "placeholder",
];

interface CreateTriggersProps {
  component: Component;
  dryRun: boolean;
}

export const createTriggers = ({ component, dryRun }: CreateTriggersProps) => {
  console.info("Creating triggers...");

  const triggersIndex = renderTriggersIndex({
    triggers: Object.entries(component.triggers).map(
      ([triggerKey, trigger]) => {
        return {
          key: trigger.key || triggerKey,
        };
      }
    ),
    dryRun,
  });

  const triggers = Object.entries(component.triggers).map(
    ([triggerKey, trigger]) => {
      const inputs = getInputs({
        inputs: trigger.inputs,
        documentProperties: DOCUMENT_PROPERTIES,
      });
      const imports = getImports({ inputs });

      return renderTrigger({
        trigger: {
          key: trigger.key || triggerKey,
          label: trigger.display.description,
          description: trigger.display.description,
          inputs,
        },
        dryRun,
        imports,
      });
    }
  );

  console.info("");

  return {
    triggersIndex,
    triggers,
  };
};

interface RenderTriggersIndexProps {
  triggers: {
    key: string;
  }[];
  dryRun: boolean;
}

const renderTriggersIndex = async ({
  triggers,
  dryRun,
}: RenderTriggersIndexProps) => {
  return await createTemplate({
    source: path.join(SOURCE_DIR, "triggers", "index.ts.ejs"),
    destination: path.join(DESTINATION_DIR, "triggers", "index.ts"),
    data: {
      triggers,
    },
    dryRun,
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
}

const renderTrigger = async ({
  dryRun,
  imports,
  trigger,
}: RenderTriggerProps) => {
  return await createTemplate({
    source: path.join(SOURCE_DIR, "triggers", "trigger.ts.ejs"),
    destination: path.join(DESTINATION_DIR, "triggers", `${trigger.key}.ts`),
    data: {
      helpers,
      imports,
      trigger,
    },
    dryRun,
  });
};
