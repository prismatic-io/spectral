import { camelCase } from "lodash";
import { toWords } from "number-to-words";

/** Convert path to grouping tag. */
export const toGroupTag = (path: string): string =>
  camelCase(path === "/" ? "root" : path.split("/")[1]).replace(
    /^(\d+)/,
    (_, match) => toWords(match)
  );
