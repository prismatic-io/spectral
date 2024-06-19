import path from "path";

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

interface CreateConnectionsProps {
  component: Component;
  dryRun: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const createConnections = async ({
  component,
  dryRun,
  sourceDir,
  destinationDir,
}: CreateConnectionsProps) => {
  console.info("Creating connections...");

  const connectionIndex = await renderConnectionsIndex({
    connections: (component.connections ?? []).map((connection) => {
      return {
        key: connection.key,
      };
    }),
    dryRun,
    sourceDir,
    destinationDir,
  });

  const connections = await Promise.all(
    (component.connections ?? []).map(async (connection) => {
      const inputs = getInputs({
        inputs: connection.inputs,
        documentProperties: DOCUMENT_PROPERTIES,
      });
      const imports = getImports({ inputs });

      return await renderConnection({
        connection: {
          key: connection.key,
          label: connection.label,
          comments: connection.comments,
          inputs,
        },
        imports,
        dryRun,
        sourceDir,
        destinationDir,
      });
    })
  );

  console.info("");

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
  sourceDir: string;
  destinationDir: string;
}

const renderConnectionsIndex = async ({
  connections,
  dryRun,
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
  });
};

interface RenderConnectionProps {
  connection: {
    key: string;
    label: string;
    comments?: string;
    inputs: Input[];
  };
  dryRun: boolean;
  imports: Imports;
  sourceDir: string;
  destinationDir: string;
}

const renderConnection = async ({
  connection,
  dryRun,
  imports,
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
  });
};
