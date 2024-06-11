#!/usr/bin/env node
import { createComponentManifest } from "./index";
import {
  COMPONENT_DIR,
  COMPONENT_DIST_DIR,
  FLAG_DRY_RUN,
  FLAG_HELP,
  FLAG_SIGNATURE_KEY,
  FLAG_HELP_TEXT,
} from "./constants";
import { createHelpFlagText } from "../utils/createHelpFlagText";

if (!COMPONENT_DIR) {
  console.error("Please run this script using npm or yarn.");
  process.exit(1);
}

if (FLAG_HELP) {
  createHelpFlagText({
    command: "component-manifest",
    flags: FLAG_HELP_TEXT,
  });
  process.exit(0);
}

createComponentManifest({
  dryRun: FLAG_DRY_RUN,
  signature: FLAG_SIGNATURE_KEY,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-var-requires
  component: require(COMPONENT_DIST_DIR).default,
});
