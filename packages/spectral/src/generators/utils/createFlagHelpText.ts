interface CreateHelpFlagsProps {
  flags: {
    [key: string]: {
      flag: string[];
      description: string;
      value: string | boolean | null;
    };
  };
  command: string;
}

export const createFlagHelpText = ({
  flags,
  command,
}: CreateHelpFlagsProps) => {
  console.log(`Usage: ${command} [options]\n`);
  console.log("Options:");

  let longestFlag = 0;
  const formattedFlags = Object.values(flags).map(
    ({ flag: flagBase, description }) => {
      const flag = flagBase.join(", ");

      if (flag.length > longestFlag) {
        longestFlag = flag.length;
      }

      return { flag, description };
    }
  );

  formattedFlags.forEach(({ flag, description }) => {
    console.log(`  ${flag.padEnd(longestFlag + 5)}  ${description}`);
  });
};
