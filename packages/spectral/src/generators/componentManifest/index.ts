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
  sourceDir: string;
  destinationDir: string;
}

export const createComponentManifest = async ({
  component,
  dryRun,
  includeSignature,
  packageName,
  spectralVersion,
  sourceDir,
  destinationDir,
}: CreateComponentManifestProps) => {
  const signature = includeSignature
    ? await getComponentSignatureWithPrism()
    : null;

  console.info(`Creating a component manifest for ${component.display.label}...
  `);

  removeComponentManifest({
    destinationDir,
  });

  await createStaticFiles({
    component,
    dryRun,
    packageName,
    signature,
    spectralVersion,
    sourceDir,
    destinationDir,
  });

  await createActions({
    component,
    dryRun,
    sourceDir,
    destinationDir,
  });

  await createTriggers({
    component,
    dryRun,
    sourceDir,
    destinationDir,
  });

  await createConnections({
    component,
    dryRun,
    sourceDir,
    destinationDir,
  });

  await createDataSources({
    component,
    dryRun,
    sourceDir,
    destinationDir,
  });

  console.info(
    `Component manifest created successfully for ${component.display.label} in ${destinationDir}! 🎉`
  );
};
