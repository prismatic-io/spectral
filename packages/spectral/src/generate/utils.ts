import { renderFile } from "ejs";
import { copyFile, mkdirp, outputFile } from "fs-extra";
import path from "path";

export const template = async (
  source: string,
  destination: string = source.replace(/\.ejs$/, ""),
  data: Record<string, unknown> = {}
): Promise<void> => {
  const templatePath = path.join(__dirname, "templates", source);

  const isTemplate = [".js", ".ts", ".json"].includes(
    path.extname(destination)
  );
  if (isTemplate) {
    const rendered = await renderFile(templatePath, data);
    await outputFile(destination, rendered, { encoding: "utf-8" });
  } else {
    await mkdirp(path.dirname(destination));
    await copyFile(templatePath, destination);
  }
};
