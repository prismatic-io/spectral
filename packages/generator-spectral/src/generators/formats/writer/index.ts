import path from "path";
import { Project, ScriptKind, SourceFile } from "ts-morph";
import { minBy } from "lodash";
import {
  Component,
  Result,
  createDescription,
  Connection,
  Action,
  Input,
} from "../utils";
import { writeConnections } from "./connections";
import { writeActions } from "./actions";

const writeComponentIndex = (
  project: Project,
  key: string,
  isPublic: boolean,
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
        .conditionalWriteLine(isPublic, "public: true,")
        .conditionalWriteLine(
          isPublic,
          `documentationUrl: "https://prismatic.io/docs/components/${key}/",`
        )
        .writeLine("display: {")
        .writeLine(`label: "${label}",`)
        .writeLine(`description: "${createDescription(description)}",`)
        .conditionalWriteLine(isPublic, `category: "Application Connectors",`)
        .writeLine(`iconPath: "${iconPath}",`)
        .writeLine("},")
        .writeLine("hooks: { error: handleErrors },")
        .writeLine("actions,")
        .writeLine("connections,")
        .writeLine("})"),
  });

  return file;
};

const writeTests = (
  project: Project,
  key: string,
  connections: Connection[],
  [{ key: actionKey, inputs }]: Action[]
): SourceFile => {
  const connection = minBy(connections, ({ orderPriority }) => orderPriority);

  const file = project.createSourceFile(
    path.join("src", "component.test.ts"),
    (writer) =>
      writer
        .writeLine(`import { testing } from "@prismatic-io/spectral";`)
        .writeLine(`import { ${connection?.key} } from "./connections";`)
        .writeLine(`import component from ".";`)
        .blankLine()
        .writeLine(`describe("${key}", () => {`)
        .writeLine("const harness = testing.createHarness(component);")
        .writeLine(
          `const connection = harness.connectionValue(${connection?.key});`
        )
        .blankLine()
        .writeLine(`it("should invoke action", async () => {`)
        .writeLine(`const result = await harness.action("${actionKey}", `)
        .block(() => {
          writer.writeLine("connection,");
          Object.entries(inputs).forEach(([key, input]) => {
            const value = `${(input as Input).default}` ?? null;
            writer.conditionalWriteLine(
              key !== "connection",
              `${key}: ${value},`
            );
          });
        })
        .writeLine(");")
        .writeLine(`expect(result?.data).toBeDefined();`)
        .writeLine("});")
        .writeLine("});")
  );

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

const writeDocumentationFiles = (
  project: Project,
  component: Component,
  connections: Connection[]
): SourceFile[] => {
  project.createDirectory("documentation");

  const descriptionFile = project.createSourceFile(
    path.join("documentation", "description.mdx"),
    (writer) => writer.writeLine(component.display.description)
  );

  if (connections.length > 0) {
    project.createDirectory(path.join("documentation", "connections"));
  }

  const connectionFiles = connections.map((connection) =>
    project.createSourceFile(
      path.join("documentation", "connections", `${connection.key}.mdx`),
      (writer) => writer.blankLine()
    )
  );

  return [descriptionFile, ...connectionFiles];
};

export const write = async (
  key: string,
  isPublic: boolean,
  { baseUrl, component, actions, connections }: Result
): Promise<Project> => {
  const project = new Project();
  project.createDirectory("src");

  writeConnections(project, connections);
  writeActions(project, actions);
  writeClient(project, baseUrl, connections);
  writeComponentIndex(project, key, isPublic, component);
  writeTests(project, key, connections, actions);

  if (isPublic) {
    writeDocumentationFiles(project, component, connections);
  }

  await project.save();

  return project;
};
