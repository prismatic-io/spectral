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

interface CreateActionsProps {
  component: Component;
  dryRun: boolean;
}

export const createActions = ({ component, dryRun }: CreateActionsProps) => {
  console.info("Creating actions...");

  const actionIndex = renderActionsIndex({
    actions: Object.entries(component.actions).map(([actionKey, action]) => {
      return {
        key: action.key || actionKey,
      };
    }),
    dryRun,
  });

  const actions = Object.entries(component.actions).map(
    ([actionKey, action]) => {
      const inputs = getInputs({
        inputs: action.inputs,
        documentProperties: DOCUMENT_PROPERTIES,
      });
      const imports = getImports({ inputs });

      return renderAction({
        action: {
          key: action.key || actionKey,
          label: action.display.description,
          description: action.display.description,
          inputs,
        },
        imports,
        dryRun,
      });
    }
  );

  console.info("");

  return {
    actionIndex,
    actions,
  };
};

interface RenderActionsIndexProps {
  actions: {
    key: string;
  }[];
  dryRun: boolean;
}

const renderActionsIndex = async ({
  actions,
  dryRun,
}: RenderActionsIndexProps) => {
  return await createTemplate({
    source: path.join(SOURCE_DIR, "actions", "index.ts.ejs"),
    destination: path.join(DESTINATION_DIR, "actions", "index.ts"),
    data: {
      actions,
    },
    dryRun,
  });
};

interface RenderActionProps {
  action: {
    key: string;
    label: string;
    description: string;
    inputs: Input[];
  };
  dryRun: boolean;
  imports: Imports;
}

const renderAction = async ({ action, imports, dryRun }: RenderActionProps) => {
  return await createTemplate({
    source: path.join(SOURCE_DIR, "actions", "action.ts.ejs"),
    destination: path.join(DESTINATION_DIR, "actions", `${action.key}.ts`),
    data: {
      action,
      helpers,
      imports,
    },
    dryRun,
  });
};
