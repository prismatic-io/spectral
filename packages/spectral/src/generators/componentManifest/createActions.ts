import path from "path";

import { type Input, getInputs } from "./getInputs";
import { type Imports, getImports } from "./getImports";
import { helpers } from "./helpers";
import { createTemplate } from "../utils/createTemplate";
import { createTypeInterface } from "../utils/createTypeInterface";
import { createImport } from "../utils/createImport";
import type { Component } from "../../serverTypes";

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
    imports: Object.entries(component.actions ?? {}).map(([actionKey, action]) => {
      return {
        import: createImport(action.key || actionKey),
      };
    }),
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
  });

  const actions = await Promise.all(
    Object.entries(component.actions ?? {}).map(async ([actionKey, action]) => {
      const inputs = getInputs({
        inputs: action.inputs,
      });

      const imports = getImports({ inputs });

      return await renderAction({
        action: {
          typeInterface: createTypeInterface(action.key || actionKey),
          import: createImport(action.key || actionKey),
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
    }),
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
  imports: {
    import: string;
  }[];
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

const renderActionsIndex = async ({
  imports,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: RenderActionsIndexProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "actions", "index.ts.ejs"),
    destination: path.join(destinationDir, "actions", "index.ts"),
    data: {
      imports,
    },
    dryRun,
    verbose,
  });
};

interface RenderActionProps {
  action: {
    typeInterface: string;
    import: string;
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
    destination: path.join(destinationDir, "actions", `${action.import}.ts`),
    data: {
      action,
      helpers,
      imports,
    },
    dryRun,
    verbose,
  });
};
