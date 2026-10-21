import type { Project, SourceFile } from "ts-morph";

/**
 * A named source migration. `transform` edits the project in place through ts-morph
 * and returns the files it changed; the runner saves only those.
 */
export interface Codemod {
  /** The spectral release the codemod migrates a project to, such as `10.36.0`. */
  version: string;
  /** The name of the migration, shared by each of its versions, such as `integration-configuration`. */
  name: string;
  /** One line shown by `--list`. */
  description: string;
  transform(project: Project): Promise<SourceFile[]>;
}

export const defineCodemod = (codemod: Codemod): Codemod => codemod;

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
