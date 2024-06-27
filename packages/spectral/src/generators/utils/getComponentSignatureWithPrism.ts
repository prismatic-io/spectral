import { exec as execCb } from "child_process";
import { promisify } from "util";

const exec = promisify(execCb);

interface GetComponentSignatureWithPrismProps {
  skipSignatureVerify: boolean;
}

export const getComponentSignatureWithPrism = async ({
  skipSignatureVerify,
}: GetComponentSignatureWithPrismProps): Promise<string | null> => {
  if (!(await isPrismAvailable())) {
    console.log("Prism must be installed.");
    process.exit(1);
  }

  const { stdout } = await exec(
    `prism components:signature ${
      skipSignatureVerify ? "--skip-signature-verify" : ""
    }`,
    {
      windowsHide: true,
    }
  );

  const signatureKey = stdout.replace(/\n$/, "");

  if (!signatureKey) {
    console.log(
      "Failed to get component signature, please verify your component has been published."
    );
    process.exit(1);
  }

  return signatureKey;
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
