import { Project } from "ts-morph";
import type { Codemod } from "./codemod";

export interface AppliedCodemod {
  /** Every file in the project after the codemod ran, keyed by path. */
  files: Record<string, string>;
  /** Paths of the files the codemod reported as changed. */
  changed: string[];
}

/** Applies a codemod to an in-memory project built from `files`, keyed by path. */
export const applyCodemod = (codemod: Codemod, files: Record<string, string>): AppliedCodemod => {
  const project = new Project({ useInMemoryFileSystem: true });
  for (const [path, text] of Object.entries(files)) {
    project.createSourceFile(path, text);
  }
  const changed = codemod.transform(project).map((file) => file.getFilePath().replace(/^\//, ""));
  return {
    files: Object.fromEntries(
      project
        .getSourceFiles()
        .map((file) => [file.getFilePath().replace(/^\//, ""), file.getFullText()]),
    ),
    changed,
  };
};

/** Applies a codemod to a single in-memory file and returns its resulting text. */
export const applyCodemodToSource = (
  codemod: Codemod,
  source: string,
): { code: string; changed: boolean } => {
  const { files, changed } = applyCodemod(codemod, { "index.ts": source });
  return { code: files["index.ts"], changed: changed.length > 0 };
};
