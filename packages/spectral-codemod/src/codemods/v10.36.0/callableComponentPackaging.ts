import { intersects, minVersion, subset, validRange } from "semver";
import {
  Node,
  type ObjectLiteralExpression,
  Project,
  type SourceFile,
  SyntaxKind,
  ts,
} from "ts-morph";
import { defineCodemod, type ProjectFiles } from "../../codemod";

const SPECTRAL = "@prismatic-io/spectral";
const CONFIG_NAMES = [
  "tsdown.config.mts",
  "tsdown.config.ts",
  "tsdown.config.cts",
  "tsdown.config.mjs",
  "tsdown.config.js",
  "tsdown.config.cjs",
];
const PACKAGE_ENTRY = { types: "./npm-dist/index.d.cts", default: "./npm-dist/index.cjs" };

// Matches Prism's callable package build. Dynamic imports avoid collisions with user bindings.
const NPM_BUILD = `{
  entry: { index: "npm-dist/.entry.ts" },
  format: "cjs",
  outDir: "npm-dist",
  platform: "node",
  target: "node22",
  clean: true,
  dts: { resolver: "tsc" },
  fixedExtension: true,
  loader: { ".md": "text" },
  copy: [{ from: "assets/**/*", to: "npm-dist", flatten: false }],
  hooks: {
    "build:before": async () => {
      const { mkdir, writeFile } = await import("node:fs/promises");
      await mkdir("npm-dist", { recursive: true });
      await writeFile("npm-dist/.entry.ts", [
        'import { callableComponent } from "@prismatic-io/spectral";',
        'import component from "../src/index";',
        'export default callableComponent(component);',
        "",
      ].join("\\n"));
    },
    "build:done": async ({ options }) => {
      const { rm } = await import("node:fs/promises");
      if (!options.watch) await rm("npm-dist/.entry.ts", { force: true });
    },
  },
}`;

const fail: (message: string) => never = (message) => {
  throw new Error(`callable-component-packaging: ${message}`);
};

const record = (value: unknown, name: string): Record<string, any> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail(`${name} must be an object.`);
  }
  return value as Record<string, any>;
};

const required = async (files: ProjectFiles, path: string): Promise<string> =>
  (await files.read(path)) ?? fail(`Missing ${path}.`);

const compatibleRange = (value: unknown, minimum: string, name: string): string => {
  if (
    typeof value !== "string" ||
    !validRange(value) ||
    !minVersion(value) ||
    !subset(value, `>=${minimum}`)
  ) {
    return fail(
      `${name} must declare a release range entirely at or above ${minimum}; found ${JSON.stringify(value)}.`,
    );
  }
  return value;
};

/** Compare syntax without depending on indentation, quote style, or trailing commas. */
const syntax = (node: Node): string => {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return JSON.stringify(node.getLiteralText());
  }
  const children = node
    .getChildren()
    .filter(
      (child) =>
        child.getKind() !== SyntaxKind.SingleLineCommentTrivia &&
        child.getKind() !== SyntaxKind.MultiLineCommentTrivia &&
        child.getText() !== "," &&
        child.getText() !== ";",
    );
  return children.length ? children.map(syntax).join(" ") : node.getText();
};

const property = (object: ObjectLiteralExpression, name: string): Node | undefined => {
  const prop = object.getProperty(name);
  return prop && Node.isPropertyAssignment(prop) ? prop.getInitializer() : undefined;
};

const literal = (object: ObjectLiteralExpression, name: string): string | undefined => {
  const value = property(object, name);
  return value && Node.isStringLiteral(value) ? value.getLiteralText() : undefined;
};

const plainObject = (node: Node | undefined, label: string): ObjectLiteralExpression => {
  if (!node || !Node.isObjectLiteralExpression(node))
    return fail(`${label} must be an object literal.`);
  const names = node.getProperties().map((prop) => {
    if (!Node.isPropertyAssignment(prop) || Node.isComputedPropertyName(prop.getNameNode())) {
      return fail(`${label} contains unsupported computed, spread, or shorthand properties.`);
    }
    const name = prop.getNameNode();
    return Node.isStringLiteral(name) ? name.getLiteralText() : prop.getName();
  });
  if (new Set(names).size !== names.length) fail(`${label} contains duplicate properties.`);
  return node;
};

const validateComponent = (source: SourceFile) => {
  const names = source
    .getImportDeclarations()
    .filter((declaration) => declaration.getModuleSpecifierValue() === SPECTRAL)
    .flatMap((declaration) => declaration.getNamedImports())
    .filter((specifier) => specifier.getName() === "component")
    .map((specifier) => specifier.getAliasNode()?.getText() ?? specifier.getName());
  let exported: Node | undefined = source
    .getExportAssignments()
    .find((assignment) => !assignment.isExportEquals())
    ?.getExpression();
  if (exported && Node.isIdentifier(exported))
    exported = source.getVariableDeclaration(exported.getText())?.getInitializer();
  if (
    !exported ||
    !Node.isCallExpression(exported) ||
    !names.includes(exported.getExpression().getText())
  ) {
    fail(
      "src/index.ts must default-export a component() imported from @prismatic-io/spectral, directly or through a local variable.",
    );
  }
};

const configureBuild = (source: SourceFile): void => {
  const defineConfig = source
    .getImportDeclarations()
    .filter((declaration) => declaration.getModuleSpecifierValue() === "tsdown")
    .flatMap((declaration) => declaration.getNamedImports())
    .find((specifier) => specifier.getName() === "defineConfig");
  const exported = source.getExportAssignments()[0]?.getExpression();
  if (
    !defineConfig ||
    !exported ||
    !Node.isCallExpression(exported) ||
    exported.getExpression().getText() !==
      (defineConfig.getAliasNode()?.getText() ?? "defineConfig") ||
    exported.getArguments().length !== 1
  ) {
    fail("The tsdown config must default-export defineConfig({...}) or defineConfig([{...}]).");
  }
  const argument = exported.getArguments()[0];
  const builds = Node.isArrayLiteralExpression(argument) ? argument.getElements() : [argument];
  if (builds.length < 1 || builds.length > 2)
    fail("Expected a platform build and, optionally, a callable npm build in the tsdown config.");
  const platform = plainObject(builds[0], "The platform build");
  const supportedOptions = new Set([
    "entry",
    "format",
    "outDir",
    "platform",
    "target",
    "clean",
    "minify",
    "dts",
    "checks",
    "deps",
    "outExtensions",
    "outputOptions",
    "loader",
    "copy",
    "sourcemap",
  ]);
  for (const option of platform.getProperties()) {
    if (Node.isPropertyAssignment(option)) {
      const name = option.getNameNode();
      const key = Node.isStringLiteral(name) ? name.getLiteralText() : option.getName();
      if (!supportedOptions.has(key))
        fail(
          `Unsupported platform build option: ${key}. Reconcile it before applying this codemod.`,
        );
    }
  }
  const entry = plainObject(property(platform, "entry"), "The platform entry");
  if (
    entry.getProperties().length !== 1 ||
    literal(entry, "index") !== "src/index.ts" ||
    literal(platform, "outDir") !== "dist" ||
    literal(platform, "format") !== "cjs" ||
    literal(platform, "platform") !== "node"
  ) {
    fail("The platform build must bundle src/index.ts as CommonJS into dist/index.js for Node.");
  }
  const expected = source
    .getProject()
    .createSourceFile("expected.ts", `const build = ${NPM_BUILD};`);
  const npmBuild = expected
    .getVariableDeclarationOrThrow("build")
    .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  // Verify the platform file extension and self-contained bundle settings without executing config.
  const probe = source.getProject().createSourceFile(
    "platform.ts",
    `const build = {
    outExtensions: () => ({ js: ".js" }),
    deps: { alwaysBundle: () => true, onlyBundle: false },
    outputOptions: { exports: "named", codeSplitting: false },
    loader: { ".md": "text" },
    copy: [{ from: "assets/**/*", to: "dist", flatten: false }],
    flatCopy: [{ from: "assets/*", to: "dist" }]
  };`,
  );
  const reference = probe
    .getVariableDeclarationOrThrow("build")
    .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  for (const key of ["outExtensions", "deps", "outputOptions"]) {
    const actual = property(platform, key);
    const expectedValue = property(reference, key);
    if (!actual || !expectedValue || syntax(actual) !== syntax(expectedValue)) {
      fail(
        `Unsupported platform ${key}; expected the self-contained CommonJS dist/index.js build settings.`,
      );
    }
  }
  // Prism scaffolds before 2026-10-15 copy assets/* flattened into dist, which copies the
  // same files as assets/**/* unless assets has subdirectories.
  for (const key of ["loader", "copy"]) {
    const actual = property(platform, key);
    const expectedValues = [property(reference, key)];
    if (key === "copy") expectedValues.push(property(reference, "flatCopy"));
    if (
      actual &&
      !expectedValues.some(
        (expectedValue) => expectedValue && syntax(actual) === syntax(expectedValue),
      )
    ) {
      fail(
        `Unsupported platform ${key}; only Markdown text loading and assets/**/* or assets/* copying are supported.`,
      );
    }
  }
  if (builds.length === 2) {
    const existing = plainObject(builds[1], "The callable npm build");
    // Also accept Prism's original hooks, which import fs functions at module scope.
    const prismBuild = source
      .getProject()
      .createSourceFile(
        "prism-build.ts",
        `const build = ${NPM_BUILD.replace(/ {6}const \{ (?:mkdir, writeFile|rm) \} = await import\("node:fs\/promises"\);\n/g, "")};`,
      )
      .getVariableDeclarationOrThrow("build")
      .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    if (syntax(existing) === syntax(npmBuild)) return;
    if (syntax(existing) !== syntax(prismBuild))
      fail(
        "An existing second tsdown build differs from the supported callable npm build. Reconcile it before applying this codemod.",
      );
    for (const name of ["mkdir", "writeFile", "rm"]) {
      const imported = source
        .getImportDeclarations()
        .some(
          (declaration) =>
            declaration.getModuleSpecifierValue() === "node:fs/promises" &&
            declaration
              .getNamedImports()
              .some((specifier) => specifier.getName() === name && !specifier.getAliasNode()),
        );
      if (!imported) fail(`Existing callable build requires ${name} from node:fs/promises.`);
    }
    return;
  }
  if (Node.isArrayLiteralExpression(argument)) argument.addElement(NPM_BUILD);
  else argument.replaceWithText(`[${argument.getText()},\n${NPM_BUILD}]`);
};

const configurePackage = (originalPackage: string) => {
  const pkg = record(JSON.parse(originalPackage), "package.json");
  if (pkg.type === "module")
    fail('The platform dist/index.js artifact requires a CommonJS package (no "type": "module").');
  const dependencies = record(pkg.dependencies ?? {}, "dependencies");
  const devDependencies = record(pkg.devDependencies ?? {}, "devDependencies");
  const peers = record(pkg.peerDependencies ?? {}, "peerDependencies");
  compatibleRange(devDependencies.tsdown ?? dependencies.tsdown, "0.22.3", "tsdown");
  if (!devDependencies.typescript && !dependencies.typescript)
    fail("TypeScript is required to generate callable declarations.");
  const spectral = compatibleRange(
    devDependencies[SPECTRAL] ?? dependencies[SPECTRAL] ?? peers[SPECTRAL],
    "10.36.0",
    SPECTRAL,
  );
  for (const group of [dependencies, devDependencies, peers]) {
    if (group[SPECTRAL] !== undefined) compatibleRange(group[SPECTRAL], "10.36.0", SPECTRAL);
    if (group[SPECTRAL] !== undefined && !intersects(spectral, group[SPECTRAL])) {
      fail("Spectral dependency declarations must have overlapping compatible ranges.");
    }
  }
  if (pkg.peerDependenciesMeta?.[SPECTRAL]?.optional)
    fail("Spectral must be a required peer dependency.");
  const scripts = record(pkg.scripts ?? {}, "scripts");
  // Steps such as typechecking or linting may run first; tsdown must run last, unchanged,
  // so that it builds both outputs.
  if (typeof scripts.build !== "string" || !/(?:^|&&\s*)tsdown\s*$/.test(scripts.build)) {
    fail(
      'Expected a build script that ends with "tsdown", such as "tsdown" or "npm run typecheck && tsdown". Custom build commands need manual configuration.',
    );
  }
  if (
    pkg.main !== undefined &&
    !["index.js", "./index.js", "dist/index.js", "./dist/index.js", PACKAGE_ENTRY.default].includes(
      pkg.main,
    )
  ) {
    fail("package.json main points to a custom entry. Reconcile it before applying this codemod.");
  }
  if (pkg.types !== undefined && pkg.types !== PACKAGE_ENTRY.types)
    fail("package.json types already points to a different declaration entry.");
  const exports = record(pkg.exports ?? {}, "exports");
  if (Object.keys(exports).some((key) => !key.startsWith(".")))
    fail("package.json exports must use subpath keys.");
  if (
    exports["."] !== undefined &&
    JSON.stringify(exports["."]) !== JSON.stringify(PACKAGE_ENTRY)
  ) {
    fail(
      "package.json already has a different root export. Reconcile it before applying this codemod.",
    );
  }
  const prismatic = record(pkg.prismatic ?? {}, "prismatic");
  if (prismatic.component !== undefined && prismatic.component !== "./dist/index.js")
    fail("prismatic.component already points to a different artifact.");
  if (
    pkg.files !== undefined &&
    (!Array.isArray(pkg.files) ||
      pkg.files.some((value: unknown) => typeof value !== "string" || value.startsWith("!")))
  ) {
    fail("package.json files must be an array of paths without exclusion patterns.");
  }
  if (scripts.prepare !== undefined && typeof scripts.prepare !== "string")
    fail("scripts.prepare must be a string.");
  pkg.main = PACKAGE_ENTRY.default;
  pkg.types = PACKAGE_ENTRY.types;
  pkg.exports = { ...exports, ".": PACKAGE_ENTRY };
  if (pkg.files !== undefined) pkg.files = [...new Set([...pkg.files, "npm-dist", "dist"])];
  pkg.prismatic = { ...prismatic, component: "./dist/index.js" };
  pkg.devDependencies = { ...devDependencies, [SPECTRAL]: spectral };
  pkg.peerDependencies = { ...peers, [SPECTRAL]: peers[SPECTRAL] ?? spectral };
  if (dependencies[SPECTRAL]) {
    delete dependencies[SPECTRAL];
    pkg.dependencies = dependencies;
  }
  pkg.scripts = {
    ...scripts,
    prepare: scripts.prepare
      ? /(?:^|&&\s*)npm run build\s*$/.test(scripts.prepare)
        ? scripts.prepare
        : `${scripts.prepare} && npm run build`
      : "npm run build",
  };
  return pkg;
};

const DIST_LINE = /^\/?dist(?:\/(?:\*\*)?)?$/;
const NPM_DIST_LINE = /^\/?npm-dist(?:\/(?:\*\*)?)?$/;

/** Ignores npm-dist beside dist, in the same style; a project that keeps dist keeps npm-dist. */
const ignoreNpmDist = (gitignore: string): string => {
  const lines = gitignore.split("\n");
  if (lines.some((line) => NPM_DIST_LINE.test(line.trim()))) return gitignore;
  const dist = lines.findIndex((line) => DIST_LINE.test(line.trim()));
  if (dist === -1) return gitignore;
  lines.splice(dist + 1, 0, lines[dist].replace("dist", "npm-dist"));
  return lines.join("\n");
};

/**
 * Excludes npm-dist from Biome beside its dist exclusion, in the same style, so a build that
 * runs Biome does not check generated declarations. A config that does not exclude dist is
 * left alone. Edits the text so comments and formatting survive.
 */
const excludeNpmDistFromBiome = (text: string): string => {
  const { config } = ts.parseConfigFileTextToJson("biome.json", text);
  const files = config?.files;
  const entries: unknown[] = [
    ...(Array.isArray(files?.includes) ? files.includes : []),
    ...(Array.isArray(files?.ignore) ? files.ignore : []),
  ];
  const patterns = entries.filter((entry): entry is string => typeof entry === "string");
  if (patterns.some((pattern) => pattern.includes("npm-dist"))) return text;
  const dist = patterns.find((pattern) => /^!*(?:\*\*\/)?dist(?:\/\*\*)?$/.test(pattern));
  if (!dist) return text;
  const quoted = JSON.stringify(dist);
  const at = text.indexOf(quoted);
  if (at === -1) return text;
  const lineStart = text.lastIndexOf("\n", at) + 1;
  const ownLine = /^\s*$/.test(text.slice(lineStart, at));
  const separator = ownLine ? `\n${text.slice(lineStart, at)}` : " ";
  const npmDist = JSON.stringify(dist.replace(/dist(?=(?:\/\*\*)?$)/, "npm-dist"));
  const end = at + quoted.length;
  return `${text.slice(0, end)},${separator}${npmDist}${text.slice(end)}`;
};

export default defineCodemod({
  version: "10.36.0",
  name: "callable-component-packaging",
  description: "Add npm packaging for callable components",
  plan: async (files: ProjectFiles) => {
    const originalPackage = await required(files, "package.json");
    const pkg = configurePackage(originalPackage);
    const configs = (
      await Promise.all(
        CONFIG_NAMES.map(async (path) => {
          const content = await files.read(path);
          return content === undefined ? [] : [{ path, content }];
        }),
      )
    ).flat();
    if (configs.length !== 1)
      fail("Expected exactly one tsdown.config.{mts,ts,cts,mjs,js,cjs} file.");
    const config = configs[0];
    const project = new Project({ useInMemoryFileSystem: true });
    const component = project.createSourceFile(
      "src/index.ts",
      await required(files, "src/index.ts"),
    );
    validateComponent(component);
    await required(files, "tsconfig.json");
    const source = project.createSourceFile(config.path, config.content);
    configureBuild(source);

    const indent = originalPackage.match(/\n([\t ]+)"/)?.[1] ?? "  ";
    const content = `${JSON.stringify(pkg, null, indent)}\n`;
    const edits = [
      { path: config.path, content: source.getFullText() },
      { path: "package.json", content },
    ];
    const gitignore = await files.read(".gitignore");
    if (gitignore !== undefined && ignoreNpmDist(gitignore) !== gitignore) {
      edits.push({ path: ".gitignore", content: ignoreNpmDist(gitignore) });
    }
    for (const path of ["biome.json", "biome.jsonc"]) {
      const biome = await files.read(path);
      if (biome !== undefined && excludeNpmDistFromBiome(biome) !== biome) {
        edits.push({ path, content: excludeNpmDistFromBiome(biome) });
      }
    }
    if (pkg.files === undefined) {
      const ignore = (await files.read(".npmignore")) ?? gitignore;
      const includeBuilds =
        "# Include generated component artifacts.\n!dist/\n!dist/**\n!npm-dist/\n!npm-dist/**\n";
      if (ignore !== undefined && !ignore.endsWith(includeBuilds)) {
        edits.push({ path: ".npmignore", content: `${ignore}\n${includeBuilds}` });
      }
    }
    return edits;
  },
});
