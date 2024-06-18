interface GetFlagBooleanValueProps {
  args: string[];
  flag: string;
}

export const getFlagBooleanValue = ({
  args,
  flag,
}: GetFlagBooleanValueProps): boolean => {
  return args.includes(flag);
};

interface GetFlagsBooleanValueProps {
  args: string[];
  flags: string[];
}

export const getFlagsBooleanValue = ({
  args,
  flags,
}: GetFlagsBooleanValueProps): boolean => {
  return flags.reduce((acc, flag) => {
    const value = getFlagBooleanValue({ args, flag });

    if (typeof value === "undefined" || acc) {
      return acc;
    }

    return value;
  }, false as boolean);
};
