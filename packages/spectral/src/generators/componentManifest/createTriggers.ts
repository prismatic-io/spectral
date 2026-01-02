import path from "path";

import { type Input, getInputs } from "./getInputs";
import { type Imports, getImports } from "./getImports";
import { helpers } from "./helpers";
import { createTemplate } from "../utils/createTemplate";
import { createTypeInterface } from "../utils/createTypeInterface";
import { createImport } from "../utils/createImport";
import type { ComponentForManifest } from "../cniComponentManifest/types";
import { Inputs, ConfigVarResultCollection, TriggerPayload, TriggerResult } from "../../types";

interface CreateTriggersProps<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
> {
  component: ComponentForManifest<
    TInputs,
    TActionInputs,
    TConfigVars,
    TPayload,
    TAllowsBranching,
    TResult
  >;
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const createTriggers = async <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
>({
  component,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: CreateTriggersProps<
  TInputs,
  TActionInputs,
  TConfigVars,
  TPayload,
  TAllowsBranching,
  TResult
>) => {
  if (verbose) {
    console.info("Creating triggers...");
  }

  const triggersIndex = await renderTriggersIndex({
    imports: Object.entries(component.triggers ?? {}).map(([triggerKey, trigger]) => {
      return {
        import: createImport(trigger.key || triggerKey),
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
          typeInterface: createTypeInterface(trigger.key || triggerKey),
          import: createImport(trigger.key || triggerKey),
          key: trigger.key || triggerKey,
          label: trigger.display.description,
          description: trigger.display.description,
          inputs,
          componentKey: component.key,
          componentIsPublic: Boolean(component.public),
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
  imports: {
    import: string;
  }[];
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

const renderTriggersIndex = async ({
  imports,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: RenderTriggersIndexProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "triggers", "index.ts.ejs"),
    destination: path.join(destinationDir, "triggers", "index.ts"),
    data: {
      imports,
    },
    dryRun,
    verbose,
  });
};

interface RenderTriggerProps {
  trigger: {
    typeInterface: string;
    import: string;
    key: string;
    label: string;
    description: string;
    inputs: Input[];
    componentKey: string;
    componentIsPublic: boolean;
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
    destination: path.join(destinationDir, "triggers", `${trigger.import}.ts`),
    data: {
      helpers,
      imports,
      trigger,
    },
    dryRun,
    verbose,
  });
};
