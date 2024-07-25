import { camelCase } from "lodash";
import { capitalizeFirstLetter } from "./capitalizeFirstLetter";

export const createTypeInterface = (key: string) => capitalizeFirstLetter(camelCase(key));
