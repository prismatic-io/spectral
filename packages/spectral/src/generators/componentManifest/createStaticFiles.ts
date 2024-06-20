import path from "path";

import { helpers } from "./helpers";
import { createTemplate } from "../utils/createTemplate";
import { Component } from "../../serverTypes";

export interface PackageDependencies {
  spectral: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface CreateStaticFilesProps {
  component: Component;
  dryRun: boolean;
  signature: string | null;
  packageName: string;
  dependencies: PackageDependencies;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
  registry: string | null;
}

export const createStaticFiles = async ({
  component,
  dryRun,
  signature,
  packageName,
  dependencies,
  verbose,
  sourceDir,
  destinationDir,
  registry,
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
    dryRun,
    dependencies,
    packageName,
    verbose,
    sourceDir,
    destinationDir,
    registry,
  });

  const tsConfig = await renderTsConfig({
    dryRun,
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
    tsConfig,
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
    destination: path.join(destinationDir, "src", "index.ts"),
    data: {
      component,
    },
    verbose,
    dryRun,
  });
};

interface RenderPackageJsonProps {
  dryRun: boolean;
  packageName: string;
  dependencies: PackageDependencies;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
  registry: string | null;
}

export const renderPackageJson = async ({
  dryRun,
  packageName,
  dependencies,
  verbose,
  sourceDir,
  destinationDir,
  registry,
}: RenderPackageJsonProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "package.json.ejs"),
    destination: path.join(destinationDir, "package.json"),
    data: {
      packageName,
      spectralVersion: dependencies.spectral,
      typescriptVersion: dependencies.devDependencies.typescript,
      helpers,
      registry,
    },
    dryRun,
    verbose,
  });
};

interface RenderTsConfigProps {
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const renderTsConfig = async ({
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: RenderTsConfigProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "tsconfig.json.ejs"),
    destination: path.join(destinationDir, "tsconfig.json"),
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
