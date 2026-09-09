import { isAbsolute, relative } from "path";
import { codemods } from "./codemods";
import { runCodemod } from "./runner";

const USAGE = `Usage: spectral-codemod <codemod> [path] [--dry-run]
       spectral-codemod --list

Applies a named migration to the project at <path> (default: the current directory).

Options:
  --dry-run   Report the files that would change without writing them.
  --list      Print the available codemods.
  --help      Print this message.`;

interface ParsedArgs {
  codemod?: string;
  path?: string;
  dryRun: boolean;
  list: boolean;
  help: boolean;
}

export const parseArgs = (argv: string[]): ParsedArgs => {
  const parsed: ParsedArgs = { dryRun: false, list: false, help: false };
  const positional: string[] = [];
  for (const arg of argv) {
    if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--list") {
      parsed.list = true;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}\n\n${USAGE}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length > 2) {
    throw new Error(`Too many arguments.\n\n${USAGE}`);
  }
  [parsed.codemod, parsed.path] = positional;
  return parsed;
};

export const listCodemods = (): string => {
  const width = Math.max(...[...codemods.keys()].map((name) => name.length));
  return [...codemods.values()]
    .map((mod) => `  ${mod.name.padEnd(width)}  ${mod.description}`)
    .join("\n");
};

/** A path inside the working directory prints relative to it; any other prints absolute. */
const displayPath = (file: string): string => {
  const rel = relative(process.cwd(), file);
  return rel.startsWith("..") || isAbsolute(rel) ? file : rel;
};

/** Runs the command line and resolves to the process exit code. */
export const main = async (
  argv: string[],
  io: { log: (line: string) => void; error: (line: string) => void } = console,
): Promise<number> => {
  const args = parseArgs(argv);

  if (args.help) {
    io.log(USAGE);
    return 0;
  }
  if (args.list) {
    io.log(listCodemods());
    return 0;
  }
  if (!args.codemod) {
    io.error(USAGE);
    return 1;
  }

  const codemod = codemods.get(args.codemod);
  if (!codemod) {
    io.error(`Unknown codemod "${args.codemod}". Available codemods:\n${listCodemods()}`);
    return 1;
  }

  const result = await runCodemod(codemod, { path: args.path, dryRun: args.dryRun });
  const verb = args.dryRun ? "would change" : "changed";
  io.log(`${codemod.name}: scanned ${result.scanned} files, ${verb} ${result.changed.length}`);
  for (const file of result.changed) {
    io.log(`  ${displayPath(file)}`);
  }
  return 0;
};
