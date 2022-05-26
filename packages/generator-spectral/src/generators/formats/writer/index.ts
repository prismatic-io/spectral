import path from "path";
import { Project, ScriptKind, SourceFile } from "ts-morph";
import { Component, Result, createDescription, Connection } from "../utils";
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
        .writeLine(`description: "${createDescription(description)}",`)
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
  connections: Connection[]
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
          `import { ${connections
            .map(({ key }) => key)
            .join(", ")} } from "./connections";`
        )
        .blankLine()
        .writeLine(`export const baseUrl = "${baseUrl}";`)
        .blankLine()
        .writeLine(
          "const toAuthorizationHeaders = (connection: Connection): { Authorization: string } => {"
        )
        .writeLine(
          "const accessToken = util.types.toString(connection.token?.access_token);"
        )
        .writeLine("if (accessToken) {")
        .writeLine("return { Authorization: `Bearer ${accessToken}` };")
        .writeLine("}")
        .blankLine()
        .writeLine(
          "const apiKey = util.types.toString(connection.fields?.apiKey);"
        )
        .writeLine("if (apiKey) {")
        .writeLine("return { Authorization: `Bearer ${apiKey}` };")
        .writeLine("}")
        .blankLine()
        .writeLine(
          "const username = util.types.toString(connection.fields?.username);"
        )
        .writeLine(
          "const password = util.types.toString(connection.fields?.password);"
        )
        .writeLine("if (username && password) {")
        .writeLine(
          'const encoded = Buffer.from(`${username}:${password}`).toString("base64");'
        )
        .writeLine("return { Authorization: `Basic ${encoded}` };")
        .writeLine("}")
        .blankLine()
        .writeLine("throw new Error(")
        .writeLine(
          "`Failed to guess at authorization parameters for Connection: ${connection.key}`"
        )
        .writeLine(");")
        .writeLine("};")
        .blankLine()
        .writeLine(
          "export const createClient = (connection: Connection): HttpClient => {"
        )
        .writeLine(
          `if (![${connections
            .map(({ key }) => `${key}.key`)
            .join(", ")}].includes(connection.key)) {`
        )
        .writeLine(
          "throw new ConnectionError(connection, `Received unexpected connection type: ${connection.key}`);"
        )
        .writeLine("}")
        .blankLine()
        .writeLine("const client = createHttpClient({")
        .writeLine("baseUrl,")
        .writeLine("headers: {")
        .writeLine("...toAuthorizationHeaders(connection),")
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

  writeConnections(project, connections);
  writeActions(project, actions);
  writeClient(project, baseUrl, connections);
  writeComponentIndex(project, key, component);

  await project.save();

  return project;
};
