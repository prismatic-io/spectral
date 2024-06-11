interface CreateHelpFlagTextProps {
  flags: {
    flag: string;
    description: string;
  }[];
  command: string;
}

export const createHelpFlagText = ({
  flags,
  command,
}: CreateHelpFlagTextProps) => {
  console.log(`Usage: ${command} [options]\n`);
  console.log("Options:");

  const longestCommand = flags.reduce(
    (max, cmd) => (cmd.flag.length > max ? cmd.flag.length : max),
    0
  );

  flags.forEach((cmd) => {
    console.log(`  ${cmd.flag.padEnd(longestCommand)}  ${cmd.description}`);
  });
};
