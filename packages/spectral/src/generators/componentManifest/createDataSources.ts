import path from "path";

import { DESTINATION_DIR, SOURCE_DIR } from "./constants";
import { Input, getInputs } from "./getInputs";
import { Imports, getImports } from "./getImports";
import { helpers } from "./helpers";
import { createTemplate } from "../utils/createTemplate";
import { Component, Input as ServerTypeInput } from "../../serverTypes";

const DOCUMENT_PROPERTIES: (keyof ServerTypeInput)[] = [
  "comments",
  "default",
  "example",
  "placeholder",
];

interface CreateDataSourcesProps {
  component: Component;
  dryRun: boolean;
}

export const createDataSources = ({
  component,
  dryRun,
}: CreateDataSourcesProps) => {
  console.info("Creating data sources...");

  const dataSourceIndex = renderDataSourcesIndex({
    dataSources: Object.entries(component.dataSources).map(
      ([dataSourceKey, dataSource]) => {
        return {
          key: dataSource.key || dataSourceKey,
        };
      }
    ),
    dryRun,
  });

  const dataSources = Object.entries(component.dataSources).map(
    ([dataSourceKey, dataSource]) => {
      const inputs = getInputs({
        inputs: dataSource.inputs,
        documentProperties: DOCUMENT_PROPERTIES,
      });

      const imports = getImports({ inputs });

      return renderDataSource({
        component: {
          key: component.key,
        },
        dataSource: {
          key: dataSource.key || dataSourceKey,
          label: dataSource.display.label,
          description: dataSource.display.description,
          inputs,
        },
        imports,
        dryRun,
      });
    }
  );

  console.info("");

  return {
    dataSourceIndex,
    dataSources,
  };
};

interface RenderDataSourcesProps {
  dataSources: {
    key: string;
  }[];
  dryRun: boolean;
}

const renderDataSourcesIndex = async ({
  dataSources,
  dryRun,
}: RenderDataSourcesProps) => {
  return await createTemplate({
    source: path.join(SOURCE_DIR, "dataSources", "index.ts.ejs"),
    destination: path.join(DESTINATION_DIR, "dataSources", "index.ts"),
    data: {
      dataSources,
    },
    dryRun,
  });
};

interface RenderDataSourceProps {
  component: {
    key: string;
  };
  dataSource: {
    key: string;
    label: string;
    description: string;
    inputs: Input[];
  };
  dryRun: boolean;
  imports: Imports;
}

const renderDataSource = async ({
  component,
  dataSource,
  dryRun,
  imports,
}: RenderDataSourceProps) => {
  return await createTemplate({
    source: path.join(SOURCE_DIR, "dataSources", "dataSource.ts.ejs"),
    destination: path.join(
      DESTINATION_DIR,
      "dataSources",
      `${dataSource.key}.ts`
    ),
    data: {
      component,
      dataSource,
      helpers,
      imports,
    },
    dryRun,
  });
};
