import path from "path";

import { type Input, getInputs } from "./getInputs";
import { type Imports, getImports } from "./getImports";
import { helpers } from "./helpers";
import { createTemplate } from "../utils/createTemplate";
import { createTypeInterface } from "../utils/createTypeInterface";
import { createImport } from "../utils/createImport";
import { ComponentForManifest } from "../cniComponentManifest/types";

interface CreateConnectionsProps {
  component: ComponentForManifest;
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
  includeGeneratedHeader?: boolean;
}

export const createConnections = async ({
  component,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
  includeGeneratedHeader = false,
}: CreateConnectionsProps) => {
  if (verbose) {
    console.info("Creating connections...");
  }

  const connectionIndex = await renderConnectionsIndex({
    imports: (component.connections ?? []).map((connection) => {
      return {
        import: createImport(connection.key),
      };
    }),
    dryRun,
    verbose,
    sourceDir,
    destinationDir,
    includeGeneratedHeader,
  });

  const connections = await Promise.all(
    (component.connections ?? []).map(async (connection) => {
      const inputs = getInputs({
        inputs: connection.inputs,
      });

      const imports = getImports({
        inputs,
        additionalImports: {
          "@prismatic-io/spectral": ["ConfigVarExpression", "ConfigVarVisibility"],
        },
      });

      const onPremAvailable = connection.inputs.some(
        (input) => input.onPremControlled || input.onPremiseControlled,
      );

      return await renderConnection({
        connection: {
          typeInterface: createTypeInterface(connection.key),
          import: createImport(connection.key),
          key: connection.key,
          label: connection.label,
          comments: connection.comments,
          inputs,
          onPremAvailable,
          component: component.key,
        },
        imports,
        dryRun,
        verbose,
        sourceDir,
        destinationDir,
        includeGeneratedHeader,
      });
    }),
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
  imports: {
    import: string;
  }[];
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
  includeGeneratedHeader: boolean;
}

const renderConnectionsIndex = async ({
  imports,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
  includeGeneratedHeader,
}: RenderConnectionsIndexProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "connections", "index.ts.ejs"),
    destination: path.join(destinationDir, "connections", "index.ts"),
    data: {
      imports,
      includeGeneratedHeader,
    },
    dryRun,
    verbose,
  });
};

interface RenderConnectionProps {
  connection: {
    typeInterface: string;
    import: string;
    key: string;
    label: string;
    comments?: string;
    inputs: Input[];
    onPremAvailable: boolean;
    component: string;
  };
  dryRun: boolean;
  imports: Imports;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
  includeGeneratedHeader: boolean;
}

const renderConnection = async ({
  connection,
  dryRun,
  imports,
  verbose,
  sourceDir,
  destinationDir,
  includeGeneratedHeader,
}: RenderConnectionProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "connections", "connection.ts.ejs"),
    destination: path.join(destinationDir, "connections", `${connection.import}.ts`),
    data: {
      connection,
      helpers,
      imports,
      includeGeneratedHeader,
    },
    dryRun,
    verbose,
  });
};
