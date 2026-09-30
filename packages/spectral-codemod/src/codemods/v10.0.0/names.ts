import type { SourceFile } from "ts-morph";
import { ensureNamedImport, SPECTRAL } from "./ast";

/** An export the generated code calls, and the local name it is imported under. */
interface Import {
  moduleSpecifier: string;
  exportName: string;
  local: string;
  /** False when the file already binds `local` to this export. */
  missing: boolean;
}

/** The names generated code in one file refers to, free of the author's bindings. */
export interface FileNames {
  z: string;
  configuration: string;
  serverFunction: string;
  elementSchema: string;
}

type Imported = "z" | "configuration" | "serverFunction";

const isZodModule = (moduleSpecifier: string): boolean =>
  moduleSpecifier === "zod" || moduleSpecifier.startsWith("zod/");

/** The local name the file already binds an export to, if any. */
const boundLocal = (
  file: SourceFile,
  matches: (moduleSpecifier: string) => boolean,
  exportName: string,
): string | undefined => {
  for (const declaration of file.getImportDeclarations()) {
    if (declaration.isTypeOnly() || !matches(declaration.getModuleSpecifierValue())) continue;
    if (exportName === "z") {
      const whole = declaration.getNamespaceImport() ?? declaration.getDefaultImport();
      if (whole) return whole.getText();
    }
    const specifier = declaration
      .getNamedImports()
      .find((named) => !named.isTypeOnly() && named.getName() === exportName);
    if (specifier) return (specifier.getAliasNode() ?? specifier.getNameNode()).getText();
  }
  return undefined;
};

/**
 * Hands out the names the codemod declares and imports, one run at a time. A name the
 * file already binds to something else gets a numeric suffix; an export the file
 * already imports is used under its local name.
 */
export const createNamer = () => {
  const reserved = new Map<SourceFile, Set<string>>();
  const files = new Map<SourceFile, { names: FileNames; imports: Map<Imported, Import> }>();

  const isTaken = (file: SourceFile, name: string): boolean =>
    reserved.get(file)?.has(name) === true || file.getLocal(name) !== undefined;

  /** A free name for a declaration the codemod adds to `file`. */
  const declare = (file: SourceFile, base: string): string => {
    let name = base;
    for (let suffix = 2; isTaken(file, name); suffix++) name = `${base}${suffix}`;
    const names = reserved.get(file) ?? new Set<string>();
    names.add(name);
    reserved.set(file, names);
    return name;
  };

  const importFor = (
    file: SourceFile,
    moduleSpecifier: string,
    matches: (moduleSpecifier: string) => boolean,
    exportName: string,
    alias: string,
  ): Import => {
    const bound = boundLocal(file, matches, exportName);
    if (bound) return { moduleSpecifier, exportName, local: bound, missing: false };
    return {
      moduleSpecifier,
      exportName,
      local: isTaken(file, exportName) ? declare(file, alias) : declare(file, exportName),
      missing: true,
    };
  };

  const entry = (file: SourceFile) => {
    const existing = files.get(file);
    if (existing) return existing;
    const imports = new Map<Imported, Import>([
      ["z", importFor(file, "zod", isZodModule, "z", "zod")],
      [
        "configuration",
        importFor(file, SPECTRAL, (m) => m === SPECTRAL, "configuration", "spectralConfiguration"),
      ],
      [
        "serverFunction",
        importFor(
          file,
          SPECTRAL,
          (m) => m === SPECTRAL,
          "serverFunction",
          "spectralServerFunction",
        ),
      ],
    ]);
    const created = {
      imports,
      names: {
        z: imports.get("z")?.local ?? "z",
        configuration: imports.get("configuration")?.local ?? "configuration",
        serverFunction: imports.get("serverFunction")?.local ?? "serverFunction",
        elementSchema: declare(file, "elementSchema"),
      },
    };
    files.set(file, created);
    return created;
  };

  return {
    declare,
    /** The names generated code in `file` uses. Resolve them before editing the file. */
    namesFor: (file: SourceFile): FileNames => entry(file).names,
    /** Imports each export `used` names, when the file does not bind it already. */
    addImports: (file: SourceFile, used: Imported[]): void => {
      for (const name of used) {
        const imported = entry(file).imports.get(name);
        if (imported?.missing) {
          ensureNamedImport(
            file,
            imported.moduleSpecifier,
            imported.exportName,
            imported.local === imported.exportName ? undefined : imported.local,
          );
        }
      }
    },
  };
};

export type Namer = ReturnType<typeof createNamer>;

const RENAMED: (keyof FileNames)[] = ["z", "configuration", "serverFunction", "elementSchema"];

/**
 * Renames the identifiers of `names` in source the codemod generated, which is written
 * with the default names. Double-quoted strings, the only strings it generates,
 * property names after a `.`, and object keys are left alone.
 */
export const withNames = (source: string, names: FileNames): string =>
  source.replace(/"(?:[^"\\]|\\.)*"|[A-Za-z_$][\w$]*/g, (token, offset: number) => {
    if (token.startsWith('"') || source[offset - 1] === ".") return token;
    // An object key, such as an element named `configuration`.
    if (/^\s*:/.test(source.slice(offset + token.length))) return token;
    const name = RENAMED.find((key) => key === token);
    return name ? names[name] : token;
  });
