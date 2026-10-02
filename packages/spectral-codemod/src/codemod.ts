import type { Project, SourceFile } from "ts-morph";

/**
 * A named source migration. `transform` edits the project in place through ts-morph
 * and returns the files it changed; the runner saves only those.
 */
export interface Codemod {
  /** Name given on the command line: `spectral-codemod <name> [path]`. */
  name: string;
  /** One line shown by `--list`. */
  description: string;
  transform(project: Project): SourceFile[];
}

export const defineCodemod = (codemod: Codemod): Codemod => codemod;

/** Lifts a file-level transform, which reports whether it changed the file, to a project transform. */
export const eachFile =
  (transform: (file: SourceFile) => boolean) =>
  (project: Project): SourceFile[] =>
    project.getSourceFiles().filter((file) => transform(file));
