import { existsSync, statSync } from "fs";
import { dirname, join, resolve } from "path";
import { Project } from "ts-morph";
import type { Codemod } from "./codemod";

export interface RunOptions {
  /** A project directory, a tsconfig.json, or a single source file. Defaults to the working directory. */
  path?: string;
  /** Report the files a codemod would change without writing them. */
  dryRun?: boolean;
}

export interface RunResult {
  /** Absolute path of every file the codemod changed. */
  changed: string[];
  /** Number of source files the codemod inspected. */
  scanned: number;
}

const SOURCE_GLOBS = ["**/*.ts", "**/*.tsx", "!**/node_modules/**", "!**/dist/**"];

/**
 * Applies one codemod to a project.
 *
 * A directory holding a `tsconfig.json` contributes the files that config includes.
 * Any other directory contributes every TypeScript file beneath it except
 * `node_modules` and `dist`. A file path contributes that file and the files it imports,
 * compiled with the nearest `tsconfig.json`'s options.
 */
export const runCodemod = async (
  codemod: Codemod,
  options: RunOptions = {},
): Promise<RunResult> => {
  const target = resolve(options.path ?? ".");
  if (!existsSync(target)) {
    throw new Error(`Path not found: ${target}`);
  }

  const project = createProject(target);
  const changed = codemod.transform(project).map((file) => file.getFilePath());

  if (!options.dryRun) {
    await project.save();
  }

  const scanned = project
    .getSourceFiles()
    .filter((file) => !file.isInNodeModules() && !file.isDeclarationFile()).length;
  return { changed, scanned };
};

const createProject = (target: string): Project => {
  if (statSync(target).isFile()) {
    if (target.endsWith("tsconfig.json")) {
      return new Project({ tsConfigFilePath: target });
    }
    const tsConfigFilePath = findUp(dirname(target), "tsconfig.json");
    const project = tsConfigFilePath
      ? new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: true })
      : new Project();
    project.addSourceFileAtPath(target);
    project.resolveSourceFileDependencies();
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

/** The nearest `name` in `dir` or one of its ancestors. */
const findUp = (dir: string, name: string): string | undefined => {
  const candidate = join(dir, name);
  if (existsSync(candidate)) return candidate;
  const parent = dirname(dir);
  return parent === dir ? undefined : findUp(parent, name);
};
