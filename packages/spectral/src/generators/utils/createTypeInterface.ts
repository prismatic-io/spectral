import camelCase from "lodash/camelCase";
import { capitalizeFirstLetter } from "./capitalizeFirstLetter";

export const createTypeInterface = (key: string) =>
  capitalizeFirstLetter(camelCase(key));
