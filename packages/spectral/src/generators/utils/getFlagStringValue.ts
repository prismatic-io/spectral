interface GetFlagStringValueProps {
  args: string[];
  flag: string;
}

export const getFlagStringValue = ({
  args,
  flag,
}: GetFlagStringValueProps): string | null => {
  const flagIndex = args.indexOf(flag);

  if (flagIndex === -1) {
    return null;
  }

  const flagValue = args[flagIndex + 1];

  if (!flagValue || flagValue.startsWith("--")) {
    return null;
  }

  return flagValue.replace(/(^"|"$)|(^'|'$)/g, "");
};

interface GetFlagsStringValueProps {
  args: string[];
  flags: string[];
}

export const getFlagsStringValue = ({
  args,
  flags,
}: GetFlagsStringValueProps): string | null => {
  return flags.reduce((acc, flag) => {
    const value = getFlagStringValue({ args, flag });

    if (typeof value === "undefined" || acc) {
      return acc;
    }

    return value;
  }, "" as string | null);
};
