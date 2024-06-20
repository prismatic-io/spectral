import { createActions } from "./createActions";
import { createConnections } from "./createConnections";
import { createDataSources } from "./createDataSources";
import { createStaticFiles } from "./createStaticFiles";
import { createTriggers } from "./createTriggers";
import { removeComponentManifest } from "./removeComponentManifest";
import { getComponentSignatureWithPrism } from "../utils/getComponentSignatureWithPrism";
import { Component } from "../../serverTypes";

interface CreateComponentManifestProps {
  component: Component;
  dryRun: boolean;
  includeSignature: boolean;
  packageName: string;
  spectralVersion: string;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const createComponentManifest = async ({
  component,
  dryRun,
  includeSignature,
  packageName,
  spectralVersion,
  verbose,
  sourceDir,
  destinationDir,
}: CreateComponentManifestProps) => {
  const signature = includeSignature
    ? await getComponentSignatureWithPrism()
    : null;

  if (verbose) {
    console.info(
      `Creating a component manifest for ${component.display.label}...`
    );
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
  });

  await createActions({
    component,
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
  });

  await createTriggers({
    component,
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
  });

  await createConnections({
    component,
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
  });

  await createDataSources({
    component,
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
  });

  console.info(
    `Component manifest created successfully for ${component.display.label} in ${destinationDir}!`
  );
};
