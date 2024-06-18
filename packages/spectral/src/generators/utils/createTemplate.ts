import { renderFile } from "ejs";
import { copyFile, mkdirp, outputFile } from "fs-extra";
import path from "path";

interface CreateTemplateProps {
  source: string;
  destination?: string;
  data?: Record<string, unknown>;
  dryRun: boolean;
}

export const createTemplate = async ({
  source,
  destination = source.replace(/\.ejs$/, ""),
  data = {},
  dryRun,
}: CreateTemplateProps): Promise<string | void> => {
  if (!source) {
    throw new Error("Source is required");
  }

  try {
    if (path.extname(source) === ".ejs") {
      const rendered = await renderFile(source, data);

      if (dryRun) {
        console.info("");
        console.info("");
        console.info(`Rendering ${source} to ${destination}`);
        console.info(
          "---------------------------- Start ----------------------------"
        );
        console.info(rendered);
        console.info(
          "---------------------------- End ----------------------------"
        );
        console.info("");
        return;
      }

      console.info(`Rendering ${source} to ${destination}`);
      await outputFile(destination, rendered, { encoding: "utf-8" });
    } else {
      if (dryRun) {
        console.info("");
        console.info(`Copying ${source} to ${destination}`);
        return;
      }

      console.info(`Copying ${source} to ${destination}`);
      await mkdirp(path.dirname(destination));
      await copyFile(source, destination);
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
};
