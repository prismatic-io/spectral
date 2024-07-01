import { rmSync, existsSync } from "fs";

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
    if (existsSync(destinationDir)) {
      rmSync(destinationDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(err);
  }

  if (verbose) {
    console.info("");
  }
};
