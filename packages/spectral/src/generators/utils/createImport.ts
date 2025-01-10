import camelCase from "lodash/camelCase";

export const createImport = (key: string) => camelCase(key);
