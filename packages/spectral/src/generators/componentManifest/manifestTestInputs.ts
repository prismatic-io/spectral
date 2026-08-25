import type { InputFieldType } from "../../types/Inputs";
import type { ServerTypeInput } from "./getInputs";

const field = (
  overrides: Partial<ServerTypeInput> & { key: string; type: string },
): ServerTypeInput => ({ label: overrides.key, required: false, ...overrides }) as ServerTypeInput;

/**
 * Exhaustive input-type surface shared by both final-manifest snapshot tests.
 * Adding an InputFieldType must add a fixture here, which updates both snapshots.
 */
const manifestInputByType: Record<InputFieldType, ServerTypeInput> = {
  string: field({
    key: "mode",
    type: "string",
    model: [
      { label: "Fast", value: "fast" },
      { label: "Safe", value: "safe" },
    ],
    default: "safe",
  }),
  data: field({ key: "data", type: "data" }),
  text: field({ key: "text", type: "text" }),
  password: field({ key: "password", type: "password" }),
  boolean: field({ key: "enabled", type: "boolean" }),
  code: field({ key: "code", type: "code" }),
  conditional: field({ key: "condition", type: "conditional" }),
  connection: field({ key: "connection", type: "connection", required: true }),
  objectSelection: field({ key: "selection", type: "objectSelection" }),
  objectFieldMap: field({ key: "fieldMap", type: "objectFieldMap" }),
  jsonForm: field({ key: "form", type: "jsonForm" }),
  dynamicObjectSelection: field({ key: "dynamicSelection", type: "dynamicObjectSelection" }),
  dynamicFieldSelection: field({ key: "dynamicField", type: "dynamicFieldSelection" }),
  date: field({ key: "date", type: "date" }),
  timestamp: field({ key: "timestamp", type: "timestamp" }),
  flow: field({ key: "flow", type: "flow" }),
  template: field({ key: "template", type: "template" }),
  structuredObject: field({
    key: "contact",
    type: "structuredObject",
    inputs: [
      field({ key: "firstName", type: "string", required: true }),
      field({ key: "active", type: "boolean" }),
    ],
  }),
  dynamicObject: field({
    key: "record",
    type: "dynamicObject",
    inputs: [
      field({
        key: "person",
        type: "structuredObject",
        inputs: [field({ key: "name", type: "string" })],
      }),
      field({
        key: "company",
        type: "structuredObject",
        inputs: [field({ key: "companyName", type: "string" })],
      }),
    ],
  }),
};

export const manifestTestInputs: ServerTypeInput[] = [
  ...Object.values(manifestInputByType),
  field({ key: "tags", type: "string", collection: "valuelist" }),
  field({ key: "headers", type: "string", collection: "keyvaluelist" }),
  field({
    key: "contacts",
    type: "structuredObject",
    collection: "valuelist",
    inputs: [field({ key: "email", type: "string" })],
  }),
];
