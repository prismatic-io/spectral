import path from "path";

import { type Input, getInputs } from "./getInputs";
import { type Imports, getImports } from "./getImports";
import { helpers } from "./helpers";
import { createTemplate } from "../utils/createTemplate";
import { createTypeInterface } from "../utils/createTypeInterface";
import { createImport } from "../utils/createImport";
import type { Component } from "../../serverTypes";
import { DataSourceType } from "../../types";

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
    imports: Object.entries(component.dataSources ?? {}).map(([dataSourceKey, dataSource]) => {
      return {
        import: createImport(dataSource.key || dataSourceKey),
      };
    }),
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
  });

  const dataSources = await Promise.all(
    Object.entries(component.dataSources ?? {}).map(async ([dataSourceKey, dataSource]) => {
      const inputs = getInputs({
        inputs: dataSource.inputs,
      });

      const imports = getImports({ inputs });

      return await renderDataSource({
        dataSource: {
          type: createTypeInterface(dataSource.key || dataSourceKey),
          import: createImport(dataSource.key || dataSourceKey),
          key: dataSource.key || dataSourceKey,
          label: dataSource.display.label,
          description: dataSource.display.description,
          dataSourceType: dataSource.dataSourceType,
          inputs,
        },
        imports,
        dryRun,
        verbose,
        sourceDir,
        destinationDir,
      });
    }),
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
  imports: {
    import: string;
  }[];
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

const renderDataSourcesIndex = async ({
  imports,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: RenderDataSourcesProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "dataSources", "index.ts.ejs"),
    destination: path.join(destinationDir, "dataSources", "index.ts"),
    data: {
      imports,
    },
    dryRun,
    verbose,
  });
};

interface RenderDataSourceProps {
  dataSource: {
    type: string;
    import: string;
    key: string;
    label: string;
    description: string;
    dataSourceType: DataSourceType;
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
    destination: path.join(destinationDir, "dataSources", `${dataSource.import}.ts`),
    data: {
      dataSource,
      helpers,
      imports,
    },
    dryRun,
    verbose,
  });
};
