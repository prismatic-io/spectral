import { InputFieldDefaultMap, type InputFieldType } from "../../types/Inputs";

const inputFieldTypes = Object.keys(InputFieldDefaultMap) as InputFieldType[];
const normalizeType = (type: string) => type.replaceAll("_", "").toLowerCase();

/** Converts API enum spellings such as `OBJECTSELECTION` and
 * `STRUCTURED_OBJECT` back to Spectral's canonical input type. Deriving the
 * choices from the exhaustive default map means new input types are supported
 * here as soon as they are added to `InputFieldType`. */
export const camelizeLowercaseType = (type: string): InputFieldType | string =>
  inputFieldTypes.find((candidate) => normalizeType(candidate) === normalizeType(type)) ?? type;
