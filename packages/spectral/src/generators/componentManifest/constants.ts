import path from "path";
import { readJsonSync } from "fs-extra";

import { getFlagsStringValue } from "../utils/getFlagStringValue";
import { getFlagsBooleanValue } from "../utils/getFlagBooleanValue";

export const FLAGS = {
  NAME: {
    flag: ["--name", "-n"],
    value: getFlagsStringValue(["--name", "-n"]),
    description:
      "The name of the component manifest. Defaults to the name of the current component being generated.",
  },
  OUTPUT_DIR: {
    flag: ["--output-dir", "-o"],
    value: getFlagsStringValue(["--output-dir", "-o"]),
    description:
      "The output directory for the component manifest. Defaults to the sibling of the current component directory.",
  },
  DRY_RUN: {
    flag: ["--dry-run", "-d"],
    value: getFlagsBooleanValue(["--dry-run", "-d"]),
    description:
      "Perform a dry run without generating the component manifest. This provides a preview of what you could expect to happen when running the command without this flag.",
  },
  INCLUDE_SIGNATURE: {
    flag: ["--include-signature", "-s"],
    value: getFlagsBooleanValue(["--include-signature", "-s"]),
    description:
      "This will include the published component's signature key. Allowing you to publish the Code Native Integrations (CNI) where this component manifest is used.",
  },
  HELP: {
    flag: ["--help", "-h"],
    value: getFlagsBooleanValue(["--help", "-h"]),
    description: "Show this help message.",
  },
};

export const COMPONENT_DIR = process.cwd();

export const COMPONENT_DIST_DIR = path.join(COMPONENT_DIR, "dist", "index.js");

export const SOURCE_DIR = path.join(__dirname, "templates");

export const DESTINATION_BASE_NAME = FLAGS.NAME.value
  ? `${FLAGS.NAME.value}-manifest`
  : `${path.basename(COMPONENT_DIR)}-manifest`;

export const DESTINATION_DIR = FLAGS.OUTPUT_DIR.value
  ? FLAGS.OUTPUT_DIR.value
  : path.join(COMPONENT_DIR, "..", DESTINATION_BASE_NAME);

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
export const SPECTRAL_VERSION = readJsonSync(
  path.join(__dirname, "../../../package.json")
).version;
