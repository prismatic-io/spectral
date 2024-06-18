const PROCESS_ARGS = process.argv.slice(3);

export const getFlagValue = (key: string) => {
  const flagIndex = PROCESS_ARGS.indexOf(key);

  if (flagIndex === -1) {
    return null;
  }

  const flagValue = PROCESS_ARGS[flagIndex + 1];

  if (!flagValue || flagValue.startsWith("--")) {
    return null;
  }

  return flagValue.replace(/^"|"$/g, "");
};
