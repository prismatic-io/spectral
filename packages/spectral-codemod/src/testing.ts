import { Project } from "ts-morph";
import type { SourceCodemod } from "./codemod";
import type { RunWarning } from "./runner";

export interface AppliedCodemod {
  /** Every file in the project after the codemod ran, keyed by path. */
  files: Record<string, string>;
  /** Paths of the files the codemod reported as changed. */
  changed: string[];
  /** The codemod's warnings, with files keyed as in `files`. */
  warnings: RunWarning[];
}

/** Applies a codemod to an in-memory project built from `files`, keyed by path. */
export const applyCodemod = async (
  codemod: SourceCodemod,
  files: Record<string, string>,
): Promise<AppliedCodemod> => {
  const project = new Project({ useInMemoryFileSystem: true });
  for (const [path, text] of Object.entries(files)) {
    project.createSourceFile(path, text);
  }
  const warnings: RunWarning[] = [];
  const context = {
    warn: (message: string, file?: string) =>
      warnings.push(file === undefined ? { message } : { message, file: file.replace(/^\//, "") }),
  };
  const changed = (await codemod.transform(project, context)).map((file) =>
    file.getFilePath().replace(/^\//, ""),
  );
  return {
    files: Object.fromEntries(
      project
        .getSourceFiles()
        .map((file) => [file.getFilePath().replace(/^\//, ""), file.getFullText()]),
    ),
    changed,
    warnings,
  };
};

/** Applies a codemod to a single in-memory file and returns its resulting text. */
export const applyCodemodToSource = async (
  codemod: SourceCodemod,
  source: string,
): Promise<{ code: string; changed: boolean }> => {
  const { files, changed } = await applyCodemod(codemod, { "index.ts": source });
  return { code: files["index.ts"], changed: changed.length > 0 };
};
