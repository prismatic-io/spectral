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
  sourceDir: string;
  destinationDir: string;
}

export const createStaticFiles = async ({
  component,
  dryRun,
  signature,
  packageName,
  spectralVersion,
  sourceDir,
  destinationDir,
}: CreateStaticFilesProps) => {
  console.info("Creating static files...");

  const index = await renderIndex({
    component: {
      key: component.key,
      public: Boolean(component.public),
      signature,
    },
    dryRun,
    sourceDir,
    destinationDir,
  });

  const packageJson = await renderPackageJson({
    dryRun,
    spectralVersion,
    packageName,
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
    sourceDir,
    destinationDir,
  });

  console.info("");

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
  sourceDir: string;
  destinationDir: string;
}

export const renderIndex = async ({
  component,
  dryRun,
  sourceDir,
  destinationDir,
}: RenderIndexProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "index.ts.ejs"),
    destination: path.join(destinationDir, "index.ts"),
    data: {
      component,
    },
    dryRun,
  });
};

interface RenderPackageJsonProps {
  dryRun: boolean;
  packageName: string;
  spectralVersion: string;
  sourceDir: string;
  destinationDir: string;
}

export const renderPackageJson = async ({
  dryRun,
  packageName,
  spectralVersion,
  sourceDir,
  destinationDir,
}: RenderPackageJsonProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "package.json.ejs"),
    destination: path.join(destinationDir, "package.json"),
    data: {
      packageName,
      spectralVersion,
      helpers,
    },
    dryRun,
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
  sourceDir: string;
  destinationDir: string;
}

export const renderReadme = async ({
  component,
  dryRun,
  packageName,
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
  });
};
