import type { Project, SourceFile } from "ts-morph";

/**
 * A named source migration. `transform` edits the project in place through ts-morph
 * and returns the files it changed; the runner saves only those.
 */
export interface Codemod {
  /** The spectral release the codemod migrates a project to, such as `10.0.0`. */
  version: string;
  /** The name of the migration, shared by each of its versions, such as `integration-configuration`. */
  name: string;
  /** One line shown by `--list`. */
  description: string;
  transform(project: Project): SourceFile[];
}

export const defineCodemod = (codemod: Codemod): Codemod => codemod;

/** The versioned name given on the command line, such as `v10.0.0/integration-configuration`. */
export const codemodId = (codemod: Codemod): string => `v${codemod.version}/${codemod.name}`;

/** Lifts a file-level transform, which reports whether it changed the file, to a project transform. */
export const eachFile =
  (transform: (file: SourceFile) => boolean) =>
  (project: Project): SourceFile[] =>
    project.getSourceFiles().filter((file) => transform(file));
