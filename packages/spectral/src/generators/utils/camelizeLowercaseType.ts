const LOWER_TO_CAMEL_MAP: Record<string, string> = {
  objectfieldmap: "objectFieldMap",
  objectselection: "objectSelection",
  dynamicfieldselection: "dynamicFieldSelection",
  dynamicobjectselection: "dynamicObjectSelection",
  jsonform: "jsonForm",
};

export const camelizeLowercaseType = (type: string) => {
  return LOWER_TO_CAMEL_MAP[type] ?? type;
};
