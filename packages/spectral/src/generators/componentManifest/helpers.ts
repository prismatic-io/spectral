import { capitalizeFirstLetter } from "../utils/capitalizeFirstLetter";
import { createDependencyImports } from "../utils/createDependencyImports";
import { formatType } from "../utils/formatType";
import { generatePackageJsonVersion } from "../utils/generatePackageJsonVersion";
import camelCase from "lodash/camelCase";

export const helpers = {
  createDependencyImports,
  capitalizeFirstLetter,
  generatePackageJsonVersion,
  formatType,
  camelCase,
};
