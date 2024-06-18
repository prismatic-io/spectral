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

interface CreateConnectionsProps {
  component: Component;
  dryRun: boolean;
}

export const createConnections = ({
  component,
  dryRun,
}: CreateConnectionsProps) => {
  console.info("Creating connections...");

  const connectionIndex = renderConnectionsIndex({
    connections: Object.entries(component.connections).map(
      ([connectionKey, connection]) => {
        return {
          key: connection.key || connectionKey,
        };
      }
    ),
    dryRun,
  });

  const connections = component.connections.map((connection) => {
    const inputs = getInputs({
      inputs: connection.inputs,
      documentProperties: DOCUMENT_PROPERTIES,
    });
    const imports = getImports({ inputs });

    return renderConnection({
      connection: {
        key: connection.key,
        label: connection.label,
        comments: connection.comments,
        inputs,
      },
      imports,
      dryRun,
    });
  });

  console.info("");

  return {
    connectionIndex,
    connections,
  };
};

interface RenderConnectionsIndexProps {
  connections: {
    key: string;
  }[];
  dryRun: boolean;
}

const renderConnectionsIndex = async ({
  connections,
  dryRun,
}: RenderConnectionsIndexProps) => {
  return await createTemplate({
    source: path.join(SOURCE_DIR, "connections", "index.ts.ejs"),
    destination: path.join(DESTINATION_DIR, "connections", "index.ts"),
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
}

const renderConnection = async ({
  connection,
  dryRun,
  imports,
}: RenderConnectionProps) => {
  return await createTemplate({
    source: path.join(SOURCE_DIR, "connections", "connection.ts.ejs"),
    destination: path.join(
      DESTINATION_DIR,
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
