import path from "path";
import { promises as fs } from "fs";
import {
  ModuleKind,
  ModuleResolutionKind,
  Project,
  ScriptKind,
  ScriptTarget,
  SourceFile,
} from "ts-morph";
import { Component, Result } from "../utils";
import { writeConnections } from "./connections";
import { writeActions } from "./actions";

const writeComponentIndex = (
  project: Project,
  key: string,
  { display: { label, description, iconPath } }: Component
): SourceFile => {
  const file = project.createSourceFile(
    path.join("src", "index.ts"),
    undefined,
    { scriptKind: ScriptKind.TS }
  );

  file.addImportDeclarations([
    { moduleSpecifier: "@prismatic-io/spectral", namedImports: ["component"] },
    {
      moduleSpecifier: "@prismatic-io/spectral/dist/clients/http",
      namedImports: ["handleErrors"],
    },
    {
      moduleSpecifier: "./actions",
      defaultImport: "actions",
    },
    {
      moduleSpecifier: "./connections",
      defaultImport: "connections",
    },
  ]);

  file.addExportAssignment({
    isExportEquals: false,
    expression: (writer) =>
      writer
        .writeLine("component({")
        .writeLine(`key: "${key}",`)
        .writeLine("display: {")
        .writeLine(`label: "${label}",`)
        .writeLine(`description: "${description}",`)
        .writeLine(`category: "Application Connectors",`)
        .writeLine(`iconPath: "${iconPath}",`)
        .writeLine("},")
        .writeLine("hooks: { error: handleErrors },")
        .writeLine("actions,")
        .writeLine("connections,")
        .writeLine("})"),
  });

  return file;
};

const writeClient = (
  project: Project,
  baseUrl: string,
  connectionNames: string[]
): SourceFile => {
  const file = project.createSourceFile(
    path.join("src", "client.ts"),
    (writer) =>
      writer
        .writeLine(
          `import { Connection, ConnectionError, util } from "@prismatic-io/spectral";`
        )
        .writeLine(
          `import { HttpClient, createClient as createHttpClient } from "@prismatic-io/spectral/dist/clients/http";`
        )
        .writeLine(
          `import { ${connectionNames.join(", ")} } from "./connections";`
        )
        .blankLine()
        .writeLine(`export const baseUrl = "${baseUrl}";`)
        .blankLine()
        .writeLine(
          "export const createClient = (connection: Connection): HttpClient => {"
        )
        .writeLine(
          `if (![${connectionNames
            .map((n) => `${n}.key`)
            .join(", ")}].includes(connection.key)) {`
        )
        .writeLine(
          `throw new ConnectionError(connection, "Received unexpected connection type");`
        )
        .writeLine("}")
        .blankLine()
        // TODO: How to handle many types of connections?
        .writeLine(
          "const accessToken = util.types.toString(connection.token?.access_token);"
        )
        .writeLine("if (!accessToken) {")
        .writeLine("throw new ConnectionError(")
        .writeLine(
          `connection, "Did not receive connection containing an access token"`
        )
        .writeLine(");")
        .writeLine("}")
        .blankLine()
        .writeLine("const client = createHttpClient({")
        .writeLine("baseUrl,")
        .writeLine("headers: {")
        .writeLine("Authorization: `Bearer ${accessToken}`,")
        .writeLine(`Accept: "application/json",`)
        .writeLine("},")
        .writeLine(`responseType: "json",`)
        .writeLine("});")
        .writeLine("return client;")
        .writeLine("};"),
    { scriptKind: ScriptKind.TS }
  );
  return file;
};

export const write = async (
  key: string,
  { baseUrl, component, actions, connections }: Result
): Promise<Project> => {
  const project = new Project();
  project.createDirectory("src");

  const { connectionNames } = writeConnections(project, connections);
  writeActions(project, actions);
  writeClient(project, baseUrl, connectionNames);
  writeComponentIndex(project, key, component);

  await project.save();

  return project;
};
