import fs from "fs";
import path from "path";

export const getSpectralVersion = () => {
  const packageInfo = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "..", "..", "package.json")).toString("utf-8"),
  );
  return packageInfo.version;
};
