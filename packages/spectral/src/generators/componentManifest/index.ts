import { DESTINATION_DIR, FLAGS } from "./constants";
import { createActions } from "./createActions";
import { createConnections } from "./createConnections";
import { createDataSources } from "./createDataSources";
import { createStaticFiles } from "./createStaticFiles";
import { createTriggers } from "./createTriggers";
import { removeComponentManifest } from "./removeComponentManifest";
import { getComponentSignatureWithPrism } from "../utils/getComponentSignatureWithPrism";
import { Component } from "../../serverTypes";
import { isObjectWithTruthyKeys } from "../../util";

interface CreateComponentManifestProps {
  component?: Component;
  dryRun: boolean;
  includeSignature: boolean;
  name: string | null;
}

export const createComponentManifest = async ({
  component,
  dryRun = FLAGS.DRY_RUN.value,
  includeSignature,
  name,
}: CreateComponentManifestProps) => {
  if (
    !component ||
    !isObjectWithTruthyKeys(component, [
      "key",
      "display",
      "actions",
      "triggers",
      "dataSources",
      "connections",
    ])
  ) {
    throw new Error("Component is invalid");
  }

  const signature = includeSignature
    ? await getComponentSignatureWithPrism()
    : null;

  console.info(`Creating a component manifest for ${component.display.label}...
  `);

  removeComponentManifest();
  createStaticFiles({ component, dryRun, signature, name });
  createActions({ component, dryRun });
  createTriggers({ component, dryRun });
  createConnections({ component, dryRun });
  createDataSources({ component, dryRun });

  console.info(
    `Component manifest created successfully for ${component.display.label} in ${DESTINATION_DIR}! 🎉`
  );
};
