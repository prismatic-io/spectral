import { Node, type ObjectLiteralExpression, Project, type SourceFile, SyntaxKind } from "ts-morph";
import { type CodemodContext, defineCodemod, type ProjectFiles } from "../../codemod";
import {
  CALLABLE_ENTRY_HOOKS,
  CONFIG_NAMES,
  HOOKS_NPM_BUILD,
  importsName,
  NPM_BUILD,
  PRISM_NPM_BUILD,
  SPECTRAL_TSDOWN,
  syntax,
} from "../v10.36.0/callableComponentPackaging";

const FS_FUNCTIONS = ["mkdir", "writeFile", "rm"];

const buildOf = (source: SourceFile, name: string, text: string): ObjectLiteralExpression =>
  source
    .getProject()
    .createSourceFile(name, `const build = ${text};`)
    .getVariableDeclarationOrThrow("build")
    .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);

/** The builds a tsdown config default-exports through defineConfig, if it has that shape. */
const buildsOf = (source: SourceFile): Node[] => {
  const exported = source.getExportAssignments()[0]?.getExpression();
  if (!exported || !Node.isCallExpression(exported)) return [];
  const argument = exported.getArguments()[0];
  if (!argument) return [];
  return Node.isArrayLiteralExpression(argument) ? argument.getElements() : [argument];
};

/** Drops fs imports that only Prism's inline hooks used. */
const removeUnusedFsImports = (source: SourceFile): void => {
  for (const declaration of source.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== "node:fs/promises") continue;
    for (const specifier of declaration.getNamedImports()) {
      const name = specifier.getName();
      if (!FS_FUNCTIONS.includes(name) || specifier.getAliasNode()) continue;
      const used = source
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some(
          (identifier) =>
            identifier.getText() === name &&
            !identifier.getFirstAncestorByKind(SyntaxKind.ImportDeclaration),
        );
      if (!used) specifier.remove();
    }
    if (
      declaration.getNamedImports().length === 0 &&
      !declaration.getDefaultImport() &&
      !declaration.getNamespaceImport()
    ) {
      declaration.remove();
    }
  }
};

export default defineCodemod({
  version: "10.39.0",
  name: "callable-entry-hooks",
  description: "Use spectral's callableEntryHooks in the callable npm build",
  plan: async (files: ProjectFiles, context: CodemodContext) => {
    const configs = (
      await Promise.all(
        CONFIG_NAMES.map(async (path) => {
          const content = await files.read(path);
          return content === undefined ? [] : [{ path, content }];
        }),
      )
    ).flat();
    if (configs.length !== 1) return [];
    const [config] = configs;
    const project = new Project({ useInMemoryFileSystem: true });
    const source = project.createSourceFile(config.path, config.content);
    const helper = syntax(buildOf(source, "hooks-build.ts", HOOKS_NPM_BUILD));
    const inline = syntax(buildOf(source, "inline-build.ts", NPM_BUILD));
    const prism = syntax(buildOf(source, "prism-build.ts", PRISM_NPM_BUILD));

    for (const build of buildsOf(source)) {
      if (!Node.isObjectLiteralExpression(build)) continue;
      const entry = build.getProperty("entry");
      if (!entry?.getText().includes("npm-dist/.entry.ts")) continue;
      const current = syntax(build);
      if (current === helper) return [];
      if (current !== inline && current !== prism) {
        context.warn(
          `The callable npm build differs from the one spectral's packaging writes, so its hooks stay as they are. Replace them with ${CALLABLE_ENTRY_HOOKS}() from ${SPECTRAL_TSDOWN} by hand.`,
          config.path,
        );
        return [];
      }
      const hooks = build.getPropertyOrThrow("hooks");
      if (!Node.isPropertyAssignment(hooks)) return [];
      hooks.setInitializer(`${CALLABLE_ENTRY_HOOKS}()`);
      if (current === prism) removeUnusedFsImports(source);
      if (!importsName(source, SPECTRAL_TSDOWN, CALLABLE_ENTRY_HOOKS)) {
        const imports = source.getImportDeclarations();
        source.insertImportDeclaration(imports.length, {
          namedImports: [CALLABLE_ENTRY_HOOKS],
          moduleSpecifier: SPECTRAL_TSDOWN,
        });
      }
      return [{ path: config.path, content: source.getFullText() }];
    }
    return [];
  },
});
