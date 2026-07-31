import type { ConfigVarResultCollection, Inputs, TriggerPayload, TriggerResult } from "../../types";
import type { ComponentForManifest } from "../cniComponentManifest/types";
import { createActions } from "./createActions";
import { createConnections } from "./createConnections";
import { createDataSources } from "./createDataSources";
import { createTriggers } from "./createTriggers";
import { removeComponentManifest } from "./removeComponentManifest";

interface GenerateManifestProps<
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
  templatesDir: string;
  manifestDir: string;
  generatedSourceDir: string;
  reusableConnectionStableKeys?: string[];
  createEntryPointFiles: () => Promise<unknown>;
  successMessage: string;
}

export const generateManifest = async <
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
  templatesDir,
  manifestDir,
  generatedSourceDir,
  reusableConnectionStableKeys,
  createEntryPointFiles,
  successMessage,
}: GenerateManifestProps<
  TInputs,
  TActionInputs,
  TConfigVars,
  TPayload,
  TAllowsBranching,
  TResult
>): Promise<void> => {
  if (!dryRun) {
    await removeComponentManifest({
      destinationDir: manifestDir,
      verbose,
    });
  }

  await Promise.all([
    createEntryPointFiles(),
    createActions({
      component,
      dryRun,
      verbose,
      sourceDir: templatesDir,
      destinationDir: generatedSourceDir,
    }),
    createTriggers({
      component,
      dryRun,
      verbose,
      sourceDir: templatesDir,
      destinationDir: generatedSourceDir,
    }),
    createConnections({
      component,
      dryRun,
      verbose,
      sourceDir: templatesDir,
      destinationDir: generatedSourceDir,
      reusableConnectionStableKeys,
    }),
    createDataSources({
      component,
      dryRun,
      verbose,
      sourceDir: templatesDir,
      destinationDir: generatedSourceDir,
    }),
  ]);

  console.info(
    dryRun
      ? `Dry run completed successfully for ${component.display.label}. No files were changed.`
      : successMessage,
  );
};
