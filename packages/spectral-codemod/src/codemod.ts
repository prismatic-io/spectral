import type { Project, SourceFile } from "ts-morph";

/**
 * Metadata shared by source transforms and project-file migrations.
 */
interface CodemodMetadata {
  /** The spectral release the codemod migrates a project to, such as `10.36.0`. */
  version: string;
  /** The name of the migration, shared by each of its versions, such as `integration-configuration`. */
  name: string;
  /** One line shown by `--list`. */
  description: string;
}

/**
 * What a codemod is given besides the files it edits. Callers always pass one, so no
 * warning goes unseen.
 */
export interface CodemodContext {
  /**
   * Reports something the codemod left for a person to handle. A warning does not stop
   * the run. `file` is the file it concerns: an absolute path for a source codemod, or a
   * path relative to the project root for a project migration.
   */
  warn(message: string, file?: string): void;
}

export interface SourceCodemod extends CodemodMetadata {
  transform(project: Project, context: CodemodContext): Promise<SourceFile[]>;
}

export interface ProjectFiles {
  /** Read a UTF-8 file relative to the project root; missing files return undefined. */
  read(path: string): Promise<string | undefined>;
}

export interface FileEdit {
  path: string;
  content: string;
}

export interface ProjectCodemod extends CodemodMetadata {
  /** Validate and plan all edits without writing. Paths are relative to the project root. */
  plan(files: ProjectFiles, context: CodemodContext): Promise<FileEdit[]>;
}

export type Codemod = SourceCodemod | ProjectCodemod;

export const defineCodemod = <T extends Codemod>(codemod: T): T => codemod;

/** The versioned name given on the command line, such as `v10.36.0/integration-configuration`. */
export const codemodId = (codemod: Codemod): string => `v${codemod.version}/${codemod.name}`;

/** Lifts a file-level transform, which reports whether it changed the file, to a project transform. */
export const eachFile =
  (transform: (file: SourceFile, context: CodemodContext) => boolean | Promise<boolean>) =>
  async (project: Project, context: CodemodContext): Promise<SourceFile[]> => {
    const changed: SourceFile[] = [];
    // Transforms share a mutable project, so preserve file order and await each edit.
    for (const file of project.getSourceFiles()) {
      if (await transform(file, context)) changed.push(file);
    }
    return changed;
  };
