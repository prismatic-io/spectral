import { exec as execCb } from "child_process";
import { promisify } from "util";

const exec = promisify(execCb);

export const getComponentSignatureWithPrism = async (): Promise<
  string | null
> => {
  if (!(await isPrismAvailable())) {
    console.log("Prism must be installed");
    process.exit(1);
  }

  const { stdout: signatureKey } = await exec("prism components:signature", {
    windowsHide: true,
  });

  if (!signatureKey) {
    console.log(
      "Failed to get component signature. Please verify your Component has been published."
    );
    process.exit(1);
  }

  return signatureKey.replace(/\n$/, "");
};

const isPrismAvailable = async (): Promise<boolean> => {
  try {
    await exec("prism --version", {
      windowsHide: true,
    });
  } catch {
    return false;
  }
  return true;
};
