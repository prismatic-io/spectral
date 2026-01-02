import path from "path";

import { type Input, getInputs } from "./getInputs";
import { type Imports, getImports } from "./getImports";
import { helpers } from "./helpers";
import { createTemplate } from "../utils/createTemplate";
import { createTypeInterface } from "../utils/createTypeInterface";
import { createImport } from "../utils/createImport";
import type { ComponentForManifest } from "../cniComponentManifest/types";
import { Inputs, ConfigVarResultCollection, TriggerPayload, TriggerResult } from "../../types";

interface CreateConnectionsProps<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
> {
  component: ComponentForManifest<
    TInputs,
    TActionInputs,
    TConfigVars,
    TPayload,
    TAllowsBranching,
    TResult
  >;
  dryRun: boolean;
  verbose: boolean;
  sourceDir: string;
  destinationDir: string;
}

export const createConnections = async <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
>({
  component,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: CreateConnectionsProps<
  TInputs,
  TActionInputs,
  TConfigVars,
  TPayload,
  TAllowsBranching,
  TResult
>) => {
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
  });

  const connections = await Promise.all(
    (component.connections ?? []).map(async (connection) => {
      const inputs = getInputs({
        inputs: connection.inputs,
      });

      const imports = getImports({
        inputs,
        additionalImports: {
          "@prismatic-io/spectral/dist/types": ["ConfigVarExpression", "ConfigVarVisibility"],
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
          componentKey: component.key,
          componentIsPublic: Boolean(component.public),
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
}

const renderConnectionsIndex = async ({
  imports,
  dryRun,
  verbose,
  sourceDir,
  destinationDir,
}: RenderConnectionsIndexProps) => {
  return await createTemplate({
    source: path.join(sourceDir, "connections", "index.ts.ejs"),
    destination: path.join(destinationDir, "connections", "index.ts"),
    data: {
      imports,
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
    componentKey: string;
    componentIsPublic: boolean;
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
    destination: path.join(destinationDir, "connections", `${connection.import}.ts`),
    data: {
      connection,
      helpers,
      imports,
    },
    dryRun,
    verbose,
  });
};
