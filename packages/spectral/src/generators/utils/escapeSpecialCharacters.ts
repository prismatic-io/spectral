/**
 * This regex targets common characters that may be included in default
 * input values (code comment blocks, backticks, etc) and would cause
 * component-manifest build issues. More characters may be added
 * as discovered.
 */

const escapeRegEx = /(\/|\\|\`|\$)/g;

export const escapeSpecialCharacters = (value = ""): string => {
  return value.replace(escapeRegEx, "\\$&");
};
