import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "path";
import { Project } from "ts-morph";
import type { Codemod, CodemodContext, ProjectCodemod } from "./codemod";

export interface RunOptions {
  /** A project directory, a tsconfig.json, or a single source file. Defaults to the working directory. */
  path?: string;
  /** Report the files a codemod would change without writing them. */
  dryRun?: boolean;
}

export interface RunResult {
  /** Absolute path of every file the codemod changed. */
  changed: string[];
  /** Number of source files inspected, or files read by a project migration. */
  scanned: number;
  /** What the codemod left for a person to handle, in the order it reported them. */
  warnings: RunWarning[];
}

export interface RunWarning {
  message: string;
  /** Absolute path of the file the warning concerns, if it concerns one. */
  file?: string;
}

/** Collects a codemod's warnings, resolving their files against `root`. */
const collectWarnings = (root: string): { context: CodemodContext; warnings: RunWarning[] } => {
  const warnings: RunWarning[] = [];
  return {
    warnings,
    context: {
      warn: (message, file) =>
        warnings.push(file === undefined ? { message } : { message, file: resolve(root, file) }),
    },
  };
};

const SOURCE_GLOBS = ["**/*.ts", "**/*.tsx", "!**/node_modules/**", "!**/dist/**"];
const TEST_GLOBS = [
  "**/*.{test,spec}.{ts,tsx,mts,cts}",
  "**/__tests__/**/*.{ts,tsx}",
  "!**/node_modules/**",
  "!**/dist/**",
];

/**
 * Applies one codemod to a project.
 *
 * A directory holding a `tsconfig.json` contributes the files that config includes.
 * Any other directory contributes every TypeScript file beneath it except
 * `node_modules` and `dist`. A file path contributes that file, the files it imports,
 * and the test files that import one of those, compiled with the nearest
 * `tsconfig.json`'s options.
 */
export const runCodemod = async (
  codemod: Codemod,
  options: RunOptions = {},
): Promise<RunResult> => {
  const target = resolve(options.path ?? ".");
  if (!existsSync(target)) {
    throw new Error(`Path not found: ${target}`);
  }

  if ("plan" in codemod) return runProjectCodemod(codemod, target, options.dryRun);

  const project = await createProject(target);
  const { context, warnings } = collectWarnings(target);
  const changed = (await codemod.transform(project, context)).map((file) => file.getFilePath());

  if (!options.dryRun) {
    await project.save();
  }

  const scanned = project
    .getSourceFiles()
    .filter((file) => !file.isInNodeModules() && !file.isDeclarationFile()).length;
  return { changed, scanned, warnings };
};

/** Project migrations stage every edit before touching disk, including in dry-run mode. */
const runProjectCodemod = async (
  codemod: ProjectCodemod,
  target: string,
  dryRun = false,
): Promise<RunResult> => {
  if (!(await stat(target)).isDirectory()) {
    throw new Error(`${codemod.name} requires a project directory.`);
  }
  const root = await realpath(target);
  const inside = (path: string) => {
    const rel = relative(root, path);
    return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
  };
  const resolveFile = async (path: string) => {
    const absolute = resolve(root, path);
    if (isAbsolute(path) || !inside(absolute) || absolute === root) {
      throw new Error(`Project file must be inside the project directory: ${path}`);
    }
    let ancestor = absolute;
    while (
      !(await lstat(ancestor).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      }))
    )
      ancestor = dirname(ancestor);
    const canonical = resolve(await realpath(ancestor), relative(ancestor, absolute));
    if (!inside(canonical) || canonical === root) {
      throw new Error(`Project file resolves outside the project directory: ${path}`);
    }
    return canonical;
  };
  const scanned = new Set<string>();
  const read = async (path: string) => {
    const absolute = await resolveFile(path);
    if (!existsSync(absolute)) return undefined;
    scanned.add(absolute);
    return readFile(absolute, "utf8");
  };
  const { context, warnings } = collectWarnings(root);
  const plan = await codemod.plan({ read }, context);
  // Validate the entire plan, including no-ops and paths aliased by symlinks.
  const destinations = await Promise.all(plan.map((edit) => resolveFile(edit.path)));
  const uniqueDestinations = new Set(destinations);
  if (uniqueDestinations.size !== destinations.length)
    throw new Error("Duplicate project file edits.");
  for (const destination of destinations) {
    for (let parent = dirname(destination); parent !== root; parent = dirname(parent)) {
      if (uniqueDestinations.has(parent)) {
        throw new Error(`Conflicting project file edits: ${parent} is a parent of ${destination}.`);
      }
    }
  }
  const originals = await Promise.all(plan.map((edit) => read(edit.path)));
  const edits = plan.flatMap((edit, index) =>
    originals[index] === edit.content ? [] : [{ ...edit, absolute: destinations[index] }],
  );
  if (!dryRun) {
    for (const edit of edits) {
      await mkdir(dirname(edit.absolute), { recursive: true });
      await writeFile(edit.absolute, edit.content);
    }
  }
  return { changed: edits.map((edit) => edit.absolute), scanned: scanned.size, warnings };
};

const createProject = async (target: string): Promise<Project> => {
  if ((await stat(target)).isFile()) {
    if (target.endsWith("tsconfig.json")) {
      return new Project({ tsConfigFilePath: target });
    }
    const tsConfigFilePath = findUp(dirname(target), "tsconfig.json");
    const project = tsConfigFilePath
      ? new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: true })
      : new Project();
    project.addSourceFileAtPath(target);
    project.resolveSourceFileDependencies();
    addTestsOf(project, dirname(tsConfigFilePath ?? target));
    return project;
  }

  const tsConfigFilePath = join(target, "tsconfig.json");
  if (existsSync(tsConfigFilePath)) {
    return new Project({ tsConfigFilePath });
  }

  const project = new Project();
  project.addSourceFilesAtPaths(
    SOURCE_GLOBS.map((glob) =>
      glob.startsWith("!") ? `!${join(target, glob.slice(1))}` : join(target, glob),
    ),
  );
  return project;
};

/**
 * Adds the test files beneath `root` that import a file the project already holds. A
 * test of anything else stays out, as the files it tests do.
 */
const addTestsOf = (project: Project, root: string): void => {
  const loaded = new Set(project.getSourceFiles());
  const candidates = project.addSourceFilesAtPaths(
    TEST_GLOBS.map((glob) =>
      glob.startsWith("!") ? `!${join(root, glob.slice(1))}` : join(root, glob),
    ),
  );
  for (const test of candidates) {
    if (loaded.has(test)) continue;
    const testsLoadedFile = test.getImportDeclarations().some((declaration) => {
      const imported = declaration.getModuleSpecifierSourceFile();
      return imported !== undefined && loaded.has(imported);
    });
    if (!testsLoadedFile) {
      project.removeSourceFile(test);
    }
  }
};

/** The nearest `name` in `dir` or one of its ancestors. */
const findUp = (dir: string, name: string): string | undefined => {
  const candidate = join(dir, name);
  if (existsSync(candidate)) return candidate;
  const parent = dirname(dir);
  return parent === dir ? undefined : findUp(parent, name);
};
