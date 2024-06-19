import path from "path";

import { helpers } from "./helpers";
import { createTemplate } from "../utils/createTemplate";
import { Component } from "../../serverTypes";

interface CreateStaticFilesProps {
  component: Component;
  dryRun: boolean;
  signature: string | null;
  packageName: string;
  spectralVersion: string;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const createStaticFiles = async ({
  component,
  dryRun,
  signature,
  packageName,
  spectralVersion,
  verbose,
  sourceDir,
  destinationDir,
}: CreateStaticFilesProps) => {
  if (verbose) {
    console.info("Creating static files...");
  }

  const index = await renderIndex({
    component: {
      key: component.key,
      public: Boolean(component.public),
      signature,
    },
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
  });

  const packageJson = await renderPackageJson({
    component: {
      signature,
    },
    dryRun,
    spectralVersion,
    packageName,
    verbose,
    sourceDir,
    destinationDir,
  });

  const readme = await renderReadme({
    component: {
      key: component.key,
      label: component.display.label,
      description: component.display.description,
    },
    packageName,
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
  });

  if (verbose) {
    console.info("");
  }

  return Promise.resolve({
    index,
    packageJson,
    readme,
  });
};

interface RenderIndexProps {
  component: {
    key: string;
    public: boolean;
    signature: string | null;
  };
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const renderIndex = async ({
  component,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: RenderIndexProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "index.ts.ejs"),
    destination: path.join(destinationDir, "index.ts"),
    data: {
      component,
    },
    verbose,
    dryRun,
  });
};

interface RenderPackageJsonProps {
  component: {
    signature: string | null;
  };
  dryRun: boolean;
  packageName: string;
  spectralVersion: string;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const renderPackageJson = async ({
  component,
  dryRun,
  packageName,
  spectralVersion,
  verbose,
  sourceDir,
  destinationDir,
}: RenderPackageJsonProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "package.json.ejs"),
    destination: path.join(destinationDir, "package.json"),
    data: {
      component,
      packageName,
      spectralVersion,
      helpers,
    },
    dryRun,
    verbose,
  });
};

interface RenderReadmeProps {
  component: {
    key: string;
    label: string;
    description: string;
  };
  dryRun: boolean;
  packageName: string;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const renderReadme = async ({
  component,
  dryRun,
  packageName,
  verbose,
  sourceDir,
  destinationDir,
}: RenderReadmeProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "README.md.ejs"),
    destination: path.join(destinationDir, "README.md"),
    data: {
      component,
      helpers,
      packageName,
    },
    dryRun,
    verbose,
  });
};
