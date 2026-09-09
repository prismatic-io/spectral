/**
 * Maps a config variable's value type onto zod source text.
 *
 * The value type is what a flow reads at runtime, which is the same for a standard
 * config var and for a data source config var of the same type.
 */

export interface ConfigVarShape {
  /** `dataType` of a standard config var, or `dataSourceType` of a data source config var. */
  valueType?: string;
  collectionType?: "valuelist" | "keyvaluelist";
  /** Literal choices of a `picklist` standard config var, when statically known. */
  pickList?: string[];
  /** `codeLanguage` of a `code` standard config var. */
  codeLanguage?: string;
}

/** Zod source for `Element`, shared by object selection and object field map values. */
export const ELEMENT_SCHEMA_NAME = "elementSchema";
export const ELEMENT_SCHEMA_SOURCE = `const ${ELEMENT_SCHEMA_NAME} = z.object({ key: z.string(), label: z.string().optional() });`;

const SCALAR: Record<string, string> = {
  string: "z.string()",
  picklist: "z.string()",
  code: "z.string()",
  htmlElement: "z.string()",
  date: "z.iso.date()",
  timestamp: "z.iso.datetime()",
  boolean: "z.boolean()",
  number: "z.number()",
  schedule: "z.object({ value: z.string(), schedule_type: z.string(), time_zone: z.string() })",
  objectSelection: `z.array(z.object({ object: ${ELEMENT_SCHEMA_NAME}, fields: z.array(${ELEMENT_SCHEMA_NAME}).optional(), defaultSelected: z.boolean().optional() }))`,
  objectFieldMap: `z.object({ fields: z.array(z.object({ field: ${ELEMENT_SCHEMA_NAME}, mappedObject: ${ELEMENT_SCHEMA_NAME}.optional(), mappedField: ${ELEMENT_SCHEMA_NAME}.optional(), defaultObject: ${ELEMENT_SCHEMA_NAME}.optional(), defaultField: ${ELEMENT_SCHEMA_NAME}.optional() })), options: z.array(z.object({ object: ${ELEMENT_SCHEMA_NAME}, fields: z.array(${ELEMENT_SCHEMA_NAME}) })).optional() })`,
  jsonForm: "z.unknown()",
};

const scalarSchemaFor = (shape: ConfigVarShape): string => {
  if (shape.valueType === "picklist" && shape.pickList?.length) {
    return `z.enum([${shape.pickList.map((choice) => JSON.stringify(choice)).join(", ")}])`;
  }
  if (shape.valueType === "code" && shape.codeLanguage === "json") {
    return "z.json()";
  }
  return (shape.valueType && SCALAR[shape.valueType]) ?? "z.unknown()";
};

/** True when the shape's zod source refers to `elementSchema`. */
export const usesElementSchema = (shape: ConfigVarShape): boolean =>
  shape.valueType === "objectSelection" || shape.valueType === "objectFieldMap";

/**
 * Zod source for one config variable. The schema describes the unpacked value: a JSON
 * code variable is the parsed document, and collection scalars are typed even though
 * the wizard stored them as strings. An unknown value type, such as a component data
 * source reference whose type lives in the component registry, becomes `z.unknown()`.
 */
export const zodSchemaFor = (shape: ConfigVarShape): string => {
  const scalar = scalarSchemaFor(shape);

  switch (shape.collectionType) {
    case "valuelist":
      return `z.array(${scalar})`;
    case "keyvaluelist":
      return `z.array(z.object({ key: z.string(), value: ${scalar} }))`;
    default:
      return scalar;
  }
};
