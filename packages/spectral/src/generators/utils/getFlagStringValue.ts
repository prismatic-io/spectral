const PROCESS_ARGS = process.argv.slice(3);

export const getFlagStringValue = (flag: string): string | null => {
  const flagIndex = PROCESS_ARGS.indexOf(flag);

  if (flagIndex === -1) {
    return null;
  }

  const flagValue = PROCESS_ARGS[flagIndex + 1];

  if (!flagValue || flagValue.startsWith("--")) {
    return null;
  }

  return flagValue.replace(/(^"|"$)|(^'|'$)/g, "");
};

export const getFlagsStringValue = (flags: string[]): string | null => {
  return flags.reduce((acc, flag) => {
    const value = getFlagStringValue(flag);

    if (typeof value === "undefined" || acc) {
      return acc;
    }

    return value;
  }, "" as string | null);
};
