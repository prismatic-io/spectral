import { OAuth2Type } from "@prismatic-io/spectral";
import { sortBy } from "lodash";
import {
  CodeBlockWriter,
  Project,
  ScriptKind,
  SourceFile,
  StructureKind,
  VariableDeclarationKind,
  VariableDeclarationStructure,
} from "ts-morph";
import { Connection, ConnectionInput } from "../utils";
import path from "path";

const writeInput = (
  writer: CodeBlockWriter,
  key: string,
  {
    label,
    type,
    comments,
    default: defaultValue,
    example,
    placeholder,
    shown,
    required,
  }: ConnectionInput
): CodeBlockWriter =>
  writer
    .writeLine(`${key}: {`)
    .writeLine(`label: "${label}",`)
    .writeLine(`type: "${type}",`)
    .conditionalWriteLine(required !== undefined, `required: ${required},`)
    .conditionalWriteLine(shown !== undefined, `shown: ${shown},`)
    .conditionalWriteLine(
      placeholder !== undefined,
      `placeholder: "${placeholder}",`
    )
    .conditionalWriteLine(
      defaultValue !== undefined,
      `default: "${defaultValue}",`
    )
    .conditionalWriteLine(example !== undefined, `example: "${example}",`)
    .conditionalWriteLine(comments !== undefined, `comments: "${comments}",`)
    .writeLine("},");

const buildConnectionDeclaration = ({
  key,
  label,
  oauth2Type,
  iconPath,
  comments,
  inputs,
}: Connection): VariableDeclarationStructure => {
  const connectionFn =
    oauth2Type === undefined ? "connection" : "oauth2Connection";

  return {
    kind: StructureKind.VariableDeclaration,
    name: key,
    leadingTrivia: (writer) => writer.blankLine(),
    trailingTrivia: (writer) => writer.blankLine(),
    initializer: (writer) =>
      writer
        .writeLine(`${connectionFn}({`)
        .writeLine(`key: "${key}",`)
        .writeLine(`label: "${label}",`)
        .conditionalWriteLine(
          comments !== undefined,
          `comments: "${comments}",`
        )
        .conditionalWriteLine(
          iconPath !== undefined,
          `iconPath: "${iconPath}",`
        )
        .conditionalWriteLine(oauth2Type !== undefined, () => {
          if (oauth2Type === OAuth2Type.AuthorizationCode) {
            return `oauth2Type: OAuth2Type.AuthorizationCode,`;
          }
          if (oauth2Type === OAuth2Type.ClientCredentials) {
            return `oauth2Type: OAuth2Type.ClientCredentials,`;
          }
          throw new Error(`Unexpected OAuth2Type: ${oauth2Type}`);
        })
        .write("inputs: ")
        .block(() =>
          Object.entries(inputs).forEach(([key, input]) =>
            writeInput(writer, key, input)
          )
        )
        .writeLine("})"),
  };
};

export const writeConnections = (
  project: Project,
  connections: Connection[]
): SourceFile => {
  const file = project.createSourceFile(
    path.join("src", "connections.ts"),
    undefined,
    { scriptKind: ScriptKind.TS }
  );

  const namedImports: string[] = [];

  const hasNonOAuth2Connection = connections.some(
    ({ oauth2Type }) => oauth2Type === undefined
  );
  if (hasNonOAuth2Connection) {
    namedImports.push("connection");
  }

  const hasOAuth2Connection = connections.some(
    ({ oauth2Type }) => oauth2Type !== undefined
  );
  if (hasOAuth2Connection) {
    namedImports.push("oauth2Connection", "OAuth2Type");
  }

  file.addImportDeclaration({
    moduleSpecifier: "@prismatic-io/spectral",
    namedImports,
  });

  const sortedConnectionKeys = sortBy(
    connections,
    ({ orderPriority }) => orderPriority
  ).map(({ key }) => key);

  const declarations = connections.map(buildConnectionDeclaration);
  file.addVariableStatements(
    declarations.map((decl) => ({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [decl],
      isExported: true,
    }))
  );

  file.addExportAssignment({
    isExportEquals: false,
    expression: (writer) =>
      writer.write("[").write(sortedConnectionKeys.join(", ")).write("]"),
  });

  return file;
};
