import { camelCase } from "lodash";

export const createImport = (key: string) => camelCase(key);
