import { removeSync } from "fs-extra";

import { DESTINATION_DIR } from "./constants";

export const removeComponentManifest = () => {
  console.info("Removing existing component manifest files...");

  try {
    removeSync(DESTINATION_DIR);
  } catch (err) {
    console.error(err);
  }

  console.info("");
};
