import path from "path";

import { type DocBlock, type Input, getInputs } from "./getInputs";
import { type Imports, getImports } from "./getImports";
import { helpers } from "./helpers";
import { createTemplate } from "../utils/createTemplate";
import type { Component } from "../../serverTypes";

const DOC_BLOCK: DocBlock = [
  {
    propertyKey: "comments",
  },
  {
    propertyKey: "default",
  },
  {
    propertyKey: "example",
  },
  {
    propertyKey: "placeholder",
  },
];

interface CreateDataSourcesProps {
  component: Component;
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const createDataSources = async ({
  component,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: CreateDataSourcesProps) => {
  if (verbose) {
    console.info("Creating data sources...");
  }

  const dataSourceIndex = await renderDataSourcesIndex({
    dataSources: Object.entries(component.dataSources ?? {}).map(
      ([dataSourceKey, dataSource]) => {
        return {
          key: dataSource.key || dataSourceKey,
        };
      }
    ),
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
  });

  const dataSources = await Promise.all(
    Object.entries(component.dataSources ?? {}).map(
      async ([dataSourceKey, dataSource]) => {
        const inputs = getInputs({
          inputs: dataSource.inputs,
          docBlock: DOC_BLOCK,
        });

        const imports = getImports({ inputs });

        return await renderDataSource({
          dataSource: {
            key: dataSource.key || dataSourceKey,
            label: dataSource.display.label,
            description: dataSource.display.description,
            inputs,
          },
          imports,
          dryRun,
          verbose,
          sourceDir,
          destinationDir,
        });
      }
    )
  );

  if (verbose) {
    console.info("");
  }

  return Promise.resolve({
    dataSourceIndex,
    dataSources,
  });
};

interface RenderDataSourcesProps {
  dataSources: {
    key: string;
  }[];
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

const renderDataSourcesIndex = async ({
  dataSources,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: RenderDataSourcesProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "dataSources", "index.ts.ejs"),
    destination: path.join(destinationDir, "dataSources", "index.ts"),
    data: {
      dataSources,
    },
    dryRun,
    verbose,
  });
};

interface RenderDataSourceProps {
  dataSource: {
    key: string;
    label: string;
    description: string;
    inputs: Input[];
  };
  dryRun: boolean;
  imports: Imports;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

const renderDataSource = async ({
  dataSource,
  dryRun,
  imports,
  verbose,
  sourceDir,
  destinationDir,
}: RenderDataSourceProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "dataSources", "dataSource.ts.ejs"),
    destination: path.join(
      destinationDir,
      "dataSources",
      `${dataSource.key}.ts`
    ),
    data: {
      dataSource,
      helpers,
      imports,
    },
    dryRun,
    verbose,
  });
};
