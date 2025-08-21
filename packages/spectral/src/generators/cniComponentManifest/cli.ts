import { fetchComponentDataForManifest } from ".";
import { createFlagHelpText } from "../utils/createFlagHelpText";
import { getFlagsBooleanValue } from "../utils/getFlagBooleanValue";
import { mkdirSync } from "node:fs";
import { createActions } from "../componentManifest/createActions";
import { createTriggers } from "../componentManifest/createTriggers";
import { createConnections } from "../componentManifest/createConnections";
import { createDataSources } from "../componentManifest/createDataSources";
import path from "node:path";
import { removeComponentManifest } from "../componentManifest/removeComponentManifest";
import { createTemplate } from "../utils/createTemplate";

export const runMain = async (process: NodeJS.Process) => {
  const args = process.argv.slice(2);
  const componentKey = args[0];
  const cniDir = process.cwd();

  const flags = {
    isPrivate: {
      flag: ["--private"],
      value: getFlagsBooleanValue({
        args,
        flags: ["--private"],
      }),
      description:
        "Denotes if the component is private. If not specified, the component is assumed to be public.",
    },
    dryRun: {
      flag: ["--dry-run", "-d"],
      value: getFlagsBooleanValue({
        args,
        flags: ["--dry-run", "-d"],
      }),
      description:
        "Perform a dry run without generating the component manifest. This provides a preview of what you could expect to happen when running the command without this flag.",
    },
    verbose: {
      flag: ["--verbose", "-v"],
      value: getFlagsBooleanValue({
        args,
        flags: ["--verbose", "-v"],
      }),
      description:
        "Provides more detailed or extensive information about the files being generated during the process.",
    },
    help: {
      flag: ["--help", "-h"],
      value: getFlagsBooleanValue({
        args,
        flags: ["--help", "-h"],
      }),
      description: "Show this help message.",
    },
  };

  if (flags.help.value || !componentKey) {
    createFlagHelpText({
      command: "cni-component-manifest COMPONENT_KEY",
      flags,
    });
    if (!componentKey) {
      console.error("\nError: COMPONENT_KEY is required.");
    }
    process.exit(!componentKey ? 1 : 0);
  }

  if (!cniDir) {
    console.error("Please run this script using npm or yarn.");
    process.exit(1);
  }

  // Fetch component data from API
  const component = await fetchComponentDataForManifest({
    componentKey,
    isPrivate: flags.isPrivate.value || false,
  });

  // Generate the manifest
  const destinationDir = path.join(process.cwd(), "src", "manifests", component.key);
  const templatesDir = path.join(__dirname, "..", "componentManifest", "templates");
  const dryRun = flags.dryRun.value;
  const verbose = flags.verbose.value;

  if (verbose) {
    console.info(`Creating component manifest for ${component.display.label}...`);
  }

  removeComponentManifest({ destinationDir, verbose });

  // Create the directory structure
  mkdirSync(destinationDir, { recursive: true });

  // Generate the source files
  await await createTemplate({
    source: path.join(templatesDir, "index.ts.ejs"),
    destination: path.join(destinationDir, "index.ts"),
    data: {
      component,
    },
    verbose,
    dryRun,
  });

  await createActions({
    component,
    dryRun,
    verbose,
    sourceDir: templatesDir,
    destinationDir,
  });

  await createTriggers({
    component,
    dryRun,
    verbose,
    sourceDir: templatesDir,
    destinationDir,
  });

  await createConnections({
    component,
    dryRun,
    verbose,
    sourceDir: templatesDir,
    destinationDir,
  });

  await createDataSources({
    component,
    dryRun,
    verbose: flags.verbose.value,
    sourceDir: templatesDir,
    destinationDir,
  });

  console.info(
    `Component manifest created successfully for ${component.display.label} in ${destinationDir}!`,
  );
};
