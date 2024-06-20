import { removeSync } from "fs-extra";

interface RemoveComponentManifestProps {
  destinationDir: string;
  verbose: boolean;
}

export const removeComponentManifest = ({
  destinationDir,
  verbose,
}: RemoveComponentManifestProps) => {
  if (verbose) {
    console.info("Removing existing component manifest files...");
  }

  try {
    removeSync(destinationDir);
  } catch (err) {
    console.error(err);
  }

  if (verbose) {
    console.info("");
  }
};
