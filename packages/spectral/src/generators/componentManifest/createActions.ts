import path from "path";

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
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const createActions = async ({
  component,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: CreateActionsProps) => {
  if (verbose) {
    console.info("Creating actions...");
  }

  const actionIndex = await renderActionsIndex({
    actions: Object.entries(component.actions ?? {}).map(
      ([actionKey, action]) => {
        return {
          key: action.key || actionKey,
        };
      }
    ),
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
  });

  const actions = await Promise.all(
    Object.entries(component.actions ?? {}).map(async ([actionKey, action]) => {
      const inputs = getInputs({
        inputs: action.inputs,
        documentProperties: DOCUMENT_PROPERTIES,
      });
      const imports = getImports({ inputs });

      return await renderAction({
        action: {
          key: action.key || actionKey,
          label: action.display.description,
          description: action.display.description,
          inputs,
        },
        imports,
        dryRun,
        verbose,
        sourceDir,
        destinationDir,
      });
    })
  );

  if (verbose) {
    console.info("");
  }

  return Promise.resolve({
    actionIndex,
    actions,
  });
};

interface RenderActionsIndexProps {
  actions: {
    key: string;
  }[];
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

const renderActionsIndex = async ({
  actions,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: RenderActionsIndexProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "actions", "index.ts.ejs"),
    destination: path.join(destinationDir, "actions", "index.ts"),
    data: {
      actions,
    },
    dryRun,
    verbose,
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
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

const renderAction = async ({
  action,
  dryRun,
  imports,
  verbose,
  sourceDir,
  destinationDir,
}: RenderActionProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "actions", "action.ts.ejs"),
    destination: path.join(destinationDir, "actions", `${action.key}.ts`),
    data: {
      action,
      helpers,
      imports,
    },
    dryRun,
    verbose,
  });
};
