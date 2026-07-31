import path from "node:path";
import type { Component } from "../../serverTypes";
import type { ConfigVarResultCollection, Inputs, TriggerPayload, TriggerResult } from "../../types";
import { getComponentSignatureWithPrism } from "../utils/prism";
import { createStaticFiles } from "./createStaticFiles";
import { generateManifest } from "./generateManifest";

interface CreateComponentManifestProps<
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
  component: Component<TInputs, TActionInputs, TConfigVars, TPayload, TAllowsBranching, TResult>;
  dryRun: boolean;
  skipSignatureVerify: boolean;
  packageName: string;
  spectralVersion: string;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
  registry: string | null;
}

export const createComponentManifest = async <
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
  skipSignatureVerify,
  packageName,
  spectralVersion,
  verbose,
  sourceDir,
  destinationDir,
  registry,
}: CreateComponentManifestProps<
  TInputs,
  TActionInputs,
  TConfigVars,
  TPayload,
  TAllowsBranching,
  TResult
>) => {
  const signature = await getComponentSignatureWithPrism({
    skipSignatureVerify,
  });

  if (verbose) {
    console.info(`Creating a component manifest for ${component.display.label}...`);
    console.log("");
  }

  const srcDir = path.join(destinationDir, "src");

  await generateManifest({
    component,
    dryRun,
    verbose,
    templatesDir: sourceDir,
    manifestDir: destinationDir,
    generatedSourceDir: srcDir,
    createEntryPointFiles: () =>
      createStaticFiles({
        component,
        dryRun,
        packageName,
        signature,
        spectralVersion,
        verbose,
        sourceDir,
        destinationDir,
        registry,
      }),
    successMessage: `Component manifest created successfully for ${component.display.label} in ${destinationDir}!`,
  });
};
