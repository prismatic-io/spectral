import path from "path";

import { DESTINATION_DIR, SOURCE_DIR, SPECTRAL_VERSION } from "./constants";
import { helpers } from "./helpers";
import { createTemplate } from "../utils/createTemplate";
import { Component } from "../../serverTypes";

interface CreateStaticFilesProps {
  component: Component;
  dryRun: boolean;
  signature: string | null;
  name: string | null;
}

export const createStaticFiles = ({
  component,
  dryRun,
  signature,
  name,
}: CreateStaticFilesProps) => {
  console.info("Creating static files...");

  const index = renderIndex({
    component: {
      key: name ?? component.key,
      public: Boolean(component.public),
      signature,
    },
    dryRun,
  });

  const packageJson = renderPackageJson({
    component: {
      key: name ?? component.key,
      spectralVersion: SPECTRAL_VERSION,
    },
    dryRun,
  });

  const readme = renderReadme({
    component: {
      key: name ?? component.key,
      label: component.display.label,
      description: component.display.description,
    },
    dryRun,
  });

  console.info("");

  return {
    index,
    packageJson,
    readme,
  };
};

interface RenderIndexProps {
  component: {
    key: string;
    public: boolean;
    signature: string | null;
  };
  dryRun: boolean;
}

export const renderIndex = async ({ component, dryRun }: RenderIndexProps) => {
  return await createTemplate({
    source: path.join(SOURCE_DIR, "index.ts.ejs"),
    destination: path.join(DESTINATION_DIR, "index.ts"),
    data: {
      component,
    },
    dryRun,
  });
};

interface RenderPackageJsonProps {
  component: {
    key: string;
    spectralVersion: string;
  };
  dryRun: boolean;
}

export const renderPackageJson = async ({
  component,
  dryRun,
}: RenderPackageJsonProps) => {
  return await createTemplate({
    source: path.join(SOURCE_DIR, "package.json.ejs"),
    destination: path.join(DESTINATION_DIR, "package.json"),
    data: {
      component,
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
}

export const renderReadme = async ({
  component,
  dryRun,
}: RenderReadmeProps) => {
  return await createTemplate({
    source: path.join(SOURCE_DIR, "README.md.ejs"),
    destination: path.join(DESTINATION_DIR, "README.md"),
    data: {
      component,
      helpers,
    },
    dryRun,
  });
};
