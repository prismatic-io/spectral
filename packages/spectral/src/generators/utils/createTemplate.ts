import { renderFile } from "ejs";
import { copyFile, mkdirp, outputFile } from "fs-extra";
import path from "path";
import { format } from "prettier";

interface CreateTemplateProps {
  source: string;
  destination?: string;
  data?: Record<string, unknown>;
  dryRun: boolean;
  verbose: boolean;
}

export const createTemplate = async ({
  source,
  destination = source.replace(/\.ejs$/, ""),
  data = {},
  dryRun,
  verbose,
}: CreateTemplateProps): Promise<string | void> => {
  if (!source) {
    throw new Error("Source is required");
  }

  try {
    if (path.extname(source) === ".ejs") {
      const render = await renderFile(source, data);
      const formattedRender = [".ts", ".js"].includes(path.extname(destination))
        ? format(render, {
            parser: "typescript",
          })
        : render;

      if (dryRun) {
        console.info("");
        console.info("");
        console.info(`Rendering ${source} to ${destination}`);
        console.info(
          "---------------------------- Start ----------------------------"
        );
        console.info(formattedRender);
        console.info(
          "---------------------------- End ----------------------------"
        );
        console.info("");
        return;
      }

      if (verbose) {
        console.info(`Rendering ${source} to ${destination}`);
      }

      await outputFile(destination, formattedRender, { encoding: "utf-8" });
    } else {
      if (dryRun) {
        console.info("");
        console.info(`Copying ${source} to ${destination}`);
        return;
      }

      if (verbose) {
        console.info(`Copying ${source} to ${destination}`);
      }

      await mkdirp(path.dirname(destination));
      await copyFile(source, destination);
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
};
