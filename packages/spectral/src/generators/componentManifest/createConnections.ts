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
  {
    propertyKey: "onPremControlled",
    propertyValue: true,
    output: "This input will be supplied when using an on prem resource.",
  },
  {
    propertyKey: "onPremiseControlled",
    propertyValue: true,
    output: "This input will be supplied when using an on prem resource.",
  },
];

interface CreateConnectionsProps {
  component: Component;
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const createConnections = async ({
  component,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: CreateConnectionsProps) => {
  if (verbose) {
    console.info("Creating connections...");
  }

  const connectionIndex = await renderConnectionsIndex({
    connections: (component.connections ?? []).map((connection) => {
      return {
        key: connection.key,
      };
    }),
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
  });

  const connections = await Promise.all(
    (component.connections ?? []).map(async (connection) => {
      const inputs = getInputs({
        inputs: connection.inputs,
        docBlock: DOC_BLOCK,
      });

      const imports = getImports({ inputs });

      const onPremAvailable = connection.inputs.some(
        (input) => input.onPremControlled || input.onPremiseControlled
      );

      return await renderConnection({
        connection: {
          key: connection.key,
          label: connection.label,
          comments: connection.comments,
          inputs,
          onPremAvailable,
        },
        imports,
        dryRun,
        verbose,
        sourceDir,
        destinationDir,
      });
    })
  );

  if (verbose) {
    console.info("");
  }

  return Promise.resolve({
    connectionIndex,
    connections,
  });
};

interface RenderConnectionsIndexProps {
  connections: {
    key: string;
  }[];
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

const renderConnectionsIndex = async ({
  connections,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: RenderConnectionsIndexProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "connections", "index.ts.ejs"),
    destination: path.join(destinationDir, "connections", "index.ts"),
    data: {
      connections,
    },
    dryRun,
    verbose,
  });
};

interface RenderConnectionProps {
  connection: {
    key: string;
    label: string;
    comments?: string;
    inputs: Input[];
    onPremAvailable: boolean;
  };
  dryRun: boolean;
  imports: Imports;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

const renderConnection = async ({
  connection,
  dryRun,
  imports,
  verbose,
  sourceDir,
  destinationDir,
}: RenderConnectionProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "connections", "connection.ts.ejs"),
    destination: path.join(
      destinationDir,
      "connections",
      `${connection.key}.ts`
    ),
    data: {
      connection,
      helpers,
      imports,
    },
    dryRun,
    verbose,
  });
};
