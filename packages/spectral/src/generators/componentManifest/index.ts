import path from "path";
import type { Component } from "../../serverTypes";
import type { ConfigVarResultCollection, Inputs, TriggerPayload, TriggerResult } from "../../types";
import { getComponentSignatureWithPrism } from "../utils/prism";
import { createActions } from "./createActions";
import { createConnections } from "./createConnections";
import { createDataSources } from "./createDataSources";
import { createStaticFiles } from "./createStaticFiles";
import { createTriggers } from "./createTriggers";
import { removeComponentManifest } from "./removeComponentManifest";

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

  removeComponentManifest({
    destinationDir,
    verbose,
  });

  await createStaticFiles({
    component,
    dryRun,
    packageName,
    signature,
    spectralVersion,
    verbose,
    sourceDir,
    destinationDir,
    registry,
  });

  const srcDir = path.join(destinationDir, "src");

  await createActions({
    component,
    dryRun,
    verbose,
    sourceDir,
    destinationDir: srcDir,
  });

  await createTriggers({
    component,
    dryRun,
    verbose,
    sourceDir,
    destinationDir: srcDir,
  });

  await createConnections({
    component,
    dryRun,
    verbose,
    sourceDir,
    destinationDir: srcDir,
  });

  await createDataSources({
    component,
    dryRun,
    verbose,
    sourceDir,
    destinationDir: srcDir,
  });

  console.info(
    `Component manifest created successfully for ${component.display.label} in ${destinationDir}!`,
  );
};
