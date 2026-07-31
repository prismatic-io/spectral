import { rm } from "node:fs/promises";

interface RemoveComponentManifestProps {
  destinationDir: string;
  verbose: boolean;
}

export const removeComponentManifest = async ({
  destinationDir,
  verbose,
}: RemoveComponentManifestProps): Promise<void> => {
  if (verbose) {
    console.info("Removing existing component manifest files...");
  }

  await rm(destinationDir, { recursive: true, force: true });

  if (verbose) {
    console.info("");
  }
};
