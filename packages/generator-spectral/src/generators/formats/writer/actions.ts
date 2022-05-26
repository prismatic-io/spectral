import path from "path";
import { camelCase, groupBy } from "lodash";
import {
  CodeBlockWriter,
  ImportDeclarationStructure,
  Project,
  ScriptKind,
  SourceFile,
  StructureKind,
  VariableDeclarationKind,
  VariableDeclarationStructure,
} from "ts-morph";
import { Action, createDescription, Input } from "../utils";

const writeInput = (
  writer: CodeBlockWriter,
  key: string,
  {
    label,
    type,
    comments,
    clean,
    default: defaultValue,
    example,
    placeholder,
    required,
    model,
  }: Input
): CodeBlockWriter =>
  writer
    .writeLine(`${key}: {`)
    .writeLine(`label: "${label}",`)
    .writeLine(`type: "${type}",`)
    .conditionalWriteLine(required !== undefined, `required: ${required},`)
    .conditionalWriteLine(
      placeholder !== undefined,
      `placeholder: "${placeholder}",`
    )
    .conditionalWriteLine(
      defaultValue !== undefined,
      `default: "${defaultValue}",`
    )
    .conditionalWriteLine(model !== undefined && model.length > 0, () => {
      const options = (model ?? []).map<string>(
        ({ label, value }) => `{label: "${label}", value: "${value}"}`
      );
      return `model: [${options.join(", ")}],`;
    })
    .conditionalWriteLine(example !== undefined, `example: \`${example}\`,`)
    .conditionalWriteLine(
      clean !== undefined,
      () => `clean: ${typeof clean === "string" ? clean : clean(writer)},`
    )
    .conditionalWriteLine(
      comments !== undefined,
      () => `comments: "${createDescription(`${comments}`)}",`
    )
    .writeLine("},");

const buildActionDeclaration = ({
  key: rawKey,
  display: { label, description },
  examplePayload,
  inputs,
  perform,
}: Action): VariableDeclarationStructure => {
  const key = camelCase(rawKey);

  return {
    kind: StructureKind.VariableDeclaration,
    name: key,
    leadingTrivia: (writer) => writer.blankLine(),
    trailingTrivia: (writer) => writer.blankLine(),
    initializer: (writer) => {
      writer
        .writeLine("action({")
        .write("display: ")
        .block(() => {
          writer
            .writeLine(`label: "${label}",`)
            .writeLine(
              `description: "${createDescription(`${description}`)}",`
            );
        })
        .write(",")
        .write("perform: ");

      if (typeof perform === "string") {
        writer.write(perform);
      } else {
        perform(writer);
      }

      writer
        .write(",")
        .write("inputs: ")
        .block(() =>
          Object.entries(inputs).forEach(([key, input]) =>
            writeInput(writer, key, input as Input)
          )
        )
        .write(",")
        .conditionalWriteLine(
          examplePayload !== undefined,
          `examplePayload: ${examplePayload},`
        )
        .writeLine("})");

      return writer;
    },
  };
};

const writeActionGroup = (
  project: Project,
  groupTag: string,
  actions: Action[]
): SourceFile => {
  const file = project.createSourceFile(
    path.join("src", "actions", `${groupTag}.ts`),
    undefined,
    { scriptKind: ScriptKind.TS }
  );

  file.addImportDeclarations([
    {
      moduleSpecifier: "@prismatic-io/spectral",
      // FIXME: Connection should _not_ be required. See openapi.ts reader for details :(
      namedImports: ["action", "util", "Connection"],
    },
    {
      moduleSpecifier: "../client",
      namedImports: ["createClient"],
    },
  ]);

  const declarations = actions.map(buildActionDeclaration);
  file.addVariableStatements(
    declarations.map((decl) => ({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [decl],
      isExported: false,
    }))
  );

  const names = declarations.map(({ name }) => name);
  file.addExportAssignment({
    isExportEquals: false,
    expression: (writer) =>
      writer.block(() => names.forEach((name) => writer.writeLine(`${name},`))),
  });

  return file;
};

const writeActionExport = (
  project: Project,
  groupTags: string[]
): SourceFile => {
  const exportFile = project.createSourceFile(
    path.join("src", "actions", "index.ts"),
    undefined,
    { scriptKind: ScriptKind.TS }
  );

  exportFile.addImportDeclarations([
    {
      moduleSpecifier: "@prismatic-io/spectral/dist/clients/http",
      namedImports: ["buildRawRequestAction"],
    },
    {
      moduleSpecifier: "../client",
      namedImports: ["baseUrl"],
    },
    ...groupTags.map<ImportDeclarationStructure>((tag) => ({
      kind: StructureKind.ImportDeclaration,
      moduleSpecifier: `./${tag}`,
      defaultImport: tag,
    })),
  ]);

  exportFile.addExportAssignment({
    isExportEquals: false,
    expression: (writer) =>
      writer.block(() => {
        groupTags.forEach((tag) => writer.writeLine(`...${tag},`));
        writer.writeLine("rawRequest: buildRawRequestAction(baseUrl),");
      }),
  });

  return exportFile;
};

export const writeActions = (
  project: Project,
  actions: Action[]
): SourceFile[] => {
  project.createDirectory(path.join("src", "actions"));

  const grouped = groupBy(actions, ({ groupTag }) => groupTag);
  const actionFiles = Object.entries(grouped).map(([tag, groupedActions]) =>
    writeActionGroup(project, tag, groupedActions)
  );

  const exportFile = writeActionExport(project, Object.keys(grouped));

  return [...actionFiles, exportFile];
};
