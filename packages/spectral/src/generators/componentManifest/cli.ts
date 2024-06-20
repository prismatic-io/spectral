/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import path from "path";
import { readJsonSync, existsSync } from "fs-extra";

import { createComponentManifest } from "./index";
import { createFlagHelpText } from "../utils/createFlagHelpText";
import { getFlagsStringValue } from "../utils/getFlagStringValue";
import { getFlagsBooleanValue } from "../utils/getFlagBooleanValue";
import { isObjectWithTruthyKeys } from "../../util";

export const runMain = async (process: NodeJS.Process) => {
  const componentDir = process.cwd();
  const componentDistDir = path.join(componentDir, "dist", "index.js");

  if (!componentDir) {
    console.error("Please run this script using npm or yarn.");
    process.exit(1);
  }

  if (!existsSync(componentDistDir)) {
    console.error(
      "Component build directory `dist` does not exist. Please verify that the component has been built."
    );
    process.exit(1);
  }

  const component = require(componentDistDir).default;

  if (
    !component ||
    !isObjectWithTruthyKeys(component, ["key", "display", "actions"])
  ) {
    console.error("Component is invalid.");
    process.exit(1);
  }

  const flags = {
    name: {
      flag: ["--name", "-n"],
      value: getFlagsStringValue({
        args: process.argv.slice(3),
        flags: ["--name", "-n"],
      }),
      description:
        "The name of the component manifest. Defaults to the name of the current component being generated.",
    },
    verbose: {
      flag: ["--verbose", "-v"],
      value: getFlagsBooleanValue({
        args: process.argv.slice(3),
        flags: ["--verbose", "-v"],
      }),
      description:
        "Provides more detailed or extensive information about the files being generated during the process.",
    },
    output_dir: {
      flag: ["--output-dir", "-o"],
      value: getFlagsStringValue({
        args: process.argv.slice(3),
        flags: ["--output-dir", "-o"],
      }),
      description:
        "The output directory for the component manifest. Defaults to the sibling of the current component directory.",
    },
    dry_run: {
      flag: ["--dry-run", "-d"],
      value: getFlagsBooleanValue({
        args: process.argv.slice(3),
        flags: ["--dry-run", "-d"],
      }),
      description:
        "Perform a dry run without generating the component manifest. This provides a preview of what you could expect to happen when running the command without this flag.",
    },
    include_signature: {
      flag: ["--include-signature", "-s"],
      value: getFlagsBooleanValue({
        args: process.argv.slice(3),
        flags: ["--include-signature", "-s"],
      }),
      description:
        "This will include the published component's signature key. Allowing you to publish the Code Native Integrations (CNI) where this component manifest is used.",
    },
    help: {
      flag: ["--help", "-h"],
      value: getFlagsBooleanValue({
        args: process.argv.slice(3),
        flags: ["--help", "-h"],
      }),
      description: "Show this help message.",
    },
  };

  if (flags.help.value) {
    createFlagHelpText({
      command: "component-manifest",
      flags,
    });
    process.exit(0);
  }

  const packageJson: {
    version: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } = readJsonSync(path.join(__dirname, "../../../package.json"));

  await createComponentManifest({
    component,
    dryRun: flags.dry_run.value,
    includeSignature: flags.include_signature.value,
    packageName: flags.name.value ?? `@components/${component.key}-manifest`,
    dependencies: {
      spectral: packageJson.version,
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies,
    },
    verbose: flags.verbose.value,
    sourceDir: path.join(__dirname, "templates"),
    destinationDir: flags.output_dir.value
      ? flags.output_dir.value
      : path.join(
          componentDir,
          "..",
          flags.name.value
            ? flags.name.value
            : `${path.basename(componentDir)}-manifest`
        ),
  });
};
