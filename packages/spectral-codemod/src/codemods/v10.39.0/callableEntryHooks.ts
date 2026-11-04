import { minVersion, subset, validRange } from "semver";
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
const SPECTRAL = "@prismatic-io/spectral";
/** The first spectral release that exports {@link SPECTRAL_TSDOWN}. */
const MINIMUM_SPECTRAL = "10.39.0";

const fail: (message: string) => never = (message) => {
  throw new Error(`callable-entry-hooks: ${message}`);
};

/**
 * Fails unless every spectral range package.json declares allows only releases that export
 * the hooks; an older lockfile install would make the rewritten config fail to load.
 */
const requireSpectralWithHooks = (packageJson: string | undefined): void => {
  if (packageJson === undefined) fail("Missing package.json.");
  const pkg = JSON.parse(packageJson) as Record<string, Record<string, unknown> | undefined>;
  const ranges = ["dependencies", "devDependencies", "peerDependencies"].flatMap((field) => {
    const range = pkg[field]?.[SPECTRAL];
    return range === undefined ? [] : [{ field, range }];
  });
  if (ranges.length === 0) fail(`package.json declares no ${SPECTRAL} dependency.`);
  for (const { field, range } of ranges) {
    if (
      typeof range !== "string" ||
      !validRange(range) ||
      !minVersion(range) ||
      !subset(range, `>=${MINIMUM_SPECTRAL}`)
    ) {
      fail(
        `${field} must declare ${SPECTRAL} at ${MINIMUM_SPECTRAL} or later, which exports ${SPECTRAL_TSDOWN}; found ${JSON.stringify(range)}. Raise it to ^${MINIMUM_SPECTRAL} and reinstall, then run this codemod again.`,
      );
    }
  }
};

/**
 * Where the config binds a name at module scope: the module an import takes it from,
 * "local" for a declaration in the file, or undefined when nothing binds it.
 */
const bindingOf = (source: SourceFile, name: string): string | undefined => {
  for (const declaration of source.getImportDeclarations()) {
    const bound =
      declaration.getDefaultImport()?.getText() === name ||
      declaration.getNamespaceImport()?.getText() === name ||
      declaration
        .getNamedImports()
        .some(
          (specifier) => (specifier.getAliasNode() ?? specifier.getNameNode()).getText() === name,
        );
    if (bound) return declaration.getModuleSpecifierValue();
  }
  const declared =
    source.getVariableDeclaration(name) ??
    source.getFunction(name) ??
    source.getClass(name) ??
    source.getEnum(name);
  return declared ? "local" : undefined;
};

const describeBinding = (binding: string | undefined): string =>
  binding === undefined ? "nowhere" : binding === "local" ? "in this file" : `from ${binding}`;

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
      const binding = bindingOf(source, CALLABLE_ENTRY_HOOKS);
      const fromSpectral =
        binding === SPECTRAL_TSDOWN && importsName(source, SPECTRAL_TSDOWN, CALLABLE_ENTRY_HOOKS);
      if (current === helper) {
        if (!fromSpectral) {
          context.warn(
            `The callable npm build calls ${CALLABLE_ENTRY_HOOKS}() bound ${describeBinding(binding)}, not imported from ${SPECTRAL_TSDOWN}.`,
            config.path,
          );
        }
        return [];
      }
      if (current !== inline && current !== prism) {
        context.warn(
          `The callable npm build differs from the one spectral's packaging writes, so its hooks stay as they are. Replace them with ${CALLABLE_ENTRY_HOOKS}() from ${SPECTRAL_TSDOWN} by hand.`,
          config.path,
        );
        return [];
      }
      if (binding !== undefined && !fromSpectral) {
        context.warn(
          `${CALLABLE_ENTRY_HOOKS} is already bound ${describeBinding(binding)}, so the inline hooks stay as they are. Rename that binding, then run this codemod again.`,
          config.path,
        );
        return [];
      }
      requireSpectralWithHooks(await files.read("package.json"));
      const hooks = build.getPropertyOrThrow("hooks");
      if (!Node.isPropertyAssignment(hooks)) return [];
      hooks.setInitializer(`${CALLABLE_ENTRY_HOOKS}()`);
      if (current === prism) removeUnusedFsImports(source);
      if (!fromSpectral) {
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
