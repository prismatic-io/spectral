import { removeSync } from "fs-extra";

interface RemoveComponentManifestProps {
  destinationDir: string;
}

export const removeComponentManifest = ({
  destinationDir,
}: RemoveComponentManifestProps) => {
  console.info("Removing existing component manifest files...");

  try {
    removeSync(destinationDir);
  } catch (err) {
    console.error(err);
  }

  console.info("");
};
