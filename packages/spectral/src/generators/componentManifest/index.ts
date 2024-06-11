import { DESTINATION_DIR, FLAG_DRY_RUN } from "./constants";
import { createActions } from "./createActions";
import { createConnections } from "./createConnections";
import { createDataSources } from "./createDataSources";
import { createStaticFiles } from "./createStaticFiles";
import { createTriggers } from "./createTriggers";
import { Component } from "../../serverTypes";

interface CreateComponentManifestProps {
  component?: Component;
  dryRun: boolean;
  signature: string | null;
}

export const createComponentManifest = ({
  component,
  dryRun = FLAG_DRY_RUN,
  signature = null,
}: CreateComponentManifestProps) => {
  if (!component) {
    throw new Error("Component is required");
  }

  console.info(`Creating a component manifest for ${component.display.label}...
  `);

  createStaticFiles({ component, dryRun, signature });
  createActions({ component, dryRun });
  createTriggers({ component, dryRun });
  createConnections({ component, dryRun });
  createDataSources({ component, dryRun });

  console.info(
    `Component manifest created successfully for ${component.display.label} in ${DESTINATION_DIR}! 🎉`
  );
};
