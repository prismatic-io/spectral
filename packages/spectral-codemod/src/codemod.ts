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

export interface SourceCodemod extends CodemodMetadata {
  transform(project: Project): Promise<SourceFile[]>;
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
  plan(files: ProjectFiles): Promise<FileEdit[]>;
}

export type Codemod = SourceCodemod | ProjectCodemod;

export const defineCodemod = <T extends Codemod>(codemod: T): T => codemod;

/** The versioned name given on the command line, such as `v10.36.0/integration-configuration`. */
export const codemodId = (codemod: Codemod): string => `v${codemod.version}/${codemod.name}`;

/** Lifts a file-level transform, which reports whether it changed the file, to a project transform. */
export const eachFile =
  (transform: (file: SourceFile) => boolean | Promise<boolean>) =>
  async (project: Project): Promise<SourceFile[]> => {
    const changed: SourceFile[] = [];
    // Transforms share a mutable project, so preserve file order and await each edit.
    for (const file of project.getSourceFiles()) {
      if (await transform(file)) changed.push(file);
    }
    return changed;
  };
