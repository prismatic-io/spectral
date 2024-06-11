import path from "path";
import { readJsonSync } from "fs-extra";

import { getFlagValue } from "../utils/getFlagValue";

export const PROCESS_ARGS = process.argv.slice(3);
export const FLAG_DRY_RUN = PROCESS_ARGS.includes("--dry-run") || false;
export const FLAG_SIGNATURE_KEY = getFlagValue("--signature");
export const FLAG_HELP = PROCESS_ARGS.includes("--help");
export const FLAG_HELP_TEXT = [
  { flag: "--help", description: "Show this help message." },
  {
    flag: "--dry-run",
    description:
      "Perform a dry run without generating the component manifest. This provides a preview of what you could expect to happen when running the command without this flag.",
  },
  {
    flag: "--signature",
    description:
      "The published component signature key. This indicates the component has been published to the Prismatic platform, allowing you to publish the Code Native Integrations (CNI) where this component manifest is used.",
  },
];

export const COMPONENT_DIR = process.cwd();
export const COMPONENT_DIST_DIR = path.join(COMPONENT_DIR, "dist", "index.js");

export const SOURCE_DIR = path.join(__dirname, "templates");
export const DESTINATION_BASE_NAME = `${path.basename(COMPONENT_DIR)}-manifest`;
export const DESTINATION_DIR = path.join(
  COMPONENT_DIR,
  "..",
  DESTINATION_BASE_NAME
);

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
export const SPECTRAL_VERSION = readJsonSync(
  path.join(__dirname, "../../../package.json")
).version;
