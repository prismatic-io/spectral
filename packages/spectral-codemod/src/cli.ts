import { isAbsolute, relative } from "path";
import { type Codemod, codemodId } from "./codemod";
import { codemods, resolveCodemod } from "./codemods";
import { runCodemod } from "./runner";

const USAGE = `Usage: spectral-codemod v<version>/<codemod> [path] [--dry-run]
       spectral-codemod <codemod> --target-spectral <version> [path] [--dry-run]
       spectral-codemod --list

Applies a migration to the project at <path> (default: the current directory).
Name the codemod with its version, such as v10.36.0/integration-configuration, or
name it alone and pass the spectral version to migrate to. The latest version of
the codemod at or below that version runs.

Options:
  --target-spectral <version>  The spectral version to migrate to, such as 10.36.2.
  --dry-run                    Report the files that would change without writing them.
  --list                       Print the available codemods.
  --help                       Print this message.`;

const TARGET_SPECTRAL = "--target-spectral";

interface ParsedArgs {
  codemod?: string;
  path?: string;
  targetSpectral?: string;
  dryRun: boolean;
  list: boolean;
  help: boolean;
}

export const parseArgs = (argv: string[]): ParsedArgs => {
  const parsed: ParsedArgs = { dryRun: false, list: false, help: false };
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === TARGET_SPECTRAL || arg.startsWith(`${TARGET_SPECTRAL}=`)) {
      const value = arg === TARGET_SPECTRAL ? argv[++index] : arg.slice(TARGET_SPECTRAL.length + 1);
      if (!value || value.startsWith("-")) {
        throw new Error(`${TARGET_SPECTRAL} needs a spectral version.\n\n${USAGE}`);
      }
      parsed.targetSpectral = value;
    } else if (arg === "--dry-run") {
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
  const width = Math.max(...[...codemods.keys()].map((id) => id.length));
  return [...codemods.entries()]
    .map(([id, mod]) => `  ${id.padEnd(width)}  ${mod.description}`)
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

  let codemod: Codemod;
  try {
    codemod = resolveCodemod(args.codemod, args.targetSpectral);
  } catch (error) {
    io.error(`${(error as Error).message} Available codemods:\n${listCodemods()}`);
    return 1;
  }

  const result = await runCodemod(codemod, { path: args.path, dryRun: args.dryRun });
  const verb = args.dryRun ? "would change" : "changed";
  io.log(
    `${codemodId(codemod)}: scanned ${result.scanned} files, ${verb} ${result.changed.length}`,
  );
  for (const file of result.changed) {
    io.log(`  ${displayPath(file)}`);
  }
  for (const { message, file } of result.warnings) {
    io.error(`warning: ${file === undefined ? "" : `${displayPath(file)}: `}${message}`);
  }
  return 0;
};
