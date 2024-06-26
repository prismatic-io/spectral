import { execFile as execFileCb } from "child_process";
import { promisify } from "util";

const execFile = promisify(execFileCb);

export const getComponentSignatureWithPrism = async (): Promise<
  string | null
> => {
  if (!(await isPrismAvailable())) {
    console.log("Prism must be installed");
    process.exit(1);
  }

  const { stdout: signatureKey } = await execFile("prism", [
    "components:signature",
  ]);

  if (!signatureKey) {
    console.log(
      "Failed to get component signature, please verify your component has been published."
    );
    process.exit(1);
  }

  return signatureKey.replace(/\n$/, "");
};

const isPrismAvailable = async (): Promise<boolean> => {
  try {
    await execFile("prism", ["--version"]);
  } catch {
    return false;
  }
  return true;
};
