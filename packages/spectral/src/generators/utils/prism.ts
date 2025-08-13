import { exec as execCb } from "child_process";
import { promisify } from "util";

const exec = promisify(execCb);

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

export const getPrismAccessToken = async (): Promise<string> => {
  if (!(await isPrismAvailable())) {
    throw new Error(
      "Prism CLI must be installed. Please install it globally and run 'prism login' to authenticate.",
    );
  }

  try {
    const { stdout } = await exec("prism me:token", {
      windowsHide: true,
    });

    const accessToken = stdout.replace(/\n$/, "").trim();

    if (!accessToken) {
      throw new Error("Failed to get access token. Please run 'prism login' to authenticate.");
    }

    return accessToken;
  } catch (error) {
    if (error instanceof Error && error.message.includes("command not found")) {
      throw new Error("Prism CLI not found. Please install it globally.");
    }
    throw new Error(
      `Failed to get access token: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

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
    `prism components:signature ${skipSignatureVerify ? "--skip-signature-verify" : ""}`,
    {
      windowsHide: true,
    },
  );

  const signatureKey = stdout.replace(/\n$/, "");

  if (!signatureKey) {
    console.log(
      "Failed to get component signature, please verify your component has been published.",
    );
    process.exit(1);
  }

  return signatureKey;
};
