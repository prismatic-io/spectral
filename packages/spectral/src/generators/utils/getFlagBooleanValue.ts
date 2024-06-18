const PROCESS_ARGS = process.argv.slice(3);

export const getFlagBooleanValue = (flag: string): boolean => {
  return PROCESS_ARGS.includes(flag);
};

export const getFlagsBooleanValue = (flags: string[]): boolean => {
  return flags.reduce((acc, flag) => {
    const value = getFlagBooleanValue(flag);

    if (typeof value === "undefined" || acc) {
      return acc;
    }

    return value;
  }, false as boolean);
};
