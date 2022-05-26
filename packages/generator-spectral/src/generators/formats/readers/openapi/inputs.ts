import { OpenAPI, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { camelCase, startCase, merge } from "lodash";
import { Input, stripUndefined } from "../../utils";
import { InputFieldChoice, InputFieldType } from "@prismatic-io/spectral";

const keywordReplacements: Record<string, string> = {
  default: "defaultValue",
  public: "isPublic",
  protected: "isProtected",
  private: "isPrivate",
  interface: "anInterface",
  context: "ctx",
  data: "aData",
};

/** Convert key to a "safe key". Specifically avoiding Javascript/Typescript keywords
 * and invalid syntax (such as hyphenated identifiers).
 */
const safeKey = (key: string): string =>
  keywordReplacements[key] ?? camelCase(key);

const toInputType: { [x: string]: { type: InputFieldType; cleanFn: string } } =
  {
    string: {
      type: "string",
      cleanFn: "toString",
    },
    integer: {
      type: "string",
      cleanFn: "toNumber",
    },
    number: {
      type: "string",
      cleanFn: "toNumber",
    },
    boolean: {
      type: "boolean",
      cleanFn: "toBool",
    },
  };

const getInputModel = (
  schema: OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject
): InputFieldChoice[] | undefined => {
  if (schema?.type === "boolean") {
    // No point generating model values for boolean
    return undefined;
  }

  if (schema?.enum) {
    return (schema?.enum ?? []).map<InputFieldChoice>((v) => ({
      label: startCase(v),
      value: v,
    }));
  }

  // Some schemas unnecessarily nest inside of an allOf so try to handle those.
  if (schema?.allOf && schema?.allOf?.[0] && !("$ref" in schema?.allOf?.[0])) {
    return (schema?.allOf?.[0]?.enum ?? []).map<InputFieldChoice>((v) => ({
      label: startCase(v),
      value: v,
    }));
  }

  return undefined;
};

const buildInput = (
  parameter: OpenAPI.Parameter,
  seenKeys: Set<string>
): Input => {
  if ("$ref" in parameter) {
    throw new Error("$ref nodes are not supported.");
  }

  const schemaType = parameter.schema?.type;
  const { type, cleanFn } = toInputType[schemaType] ?? toInputType["string"];

  const { name: paramKey } = parameter;
  const key = seenKeys.has(safeKey(paramKey))
    ? safeKey(`other ${paramKey}`)
    : safeKey(paramKey);
  seenKeys.add(key);

  const model = getInputModel(parameter.schema);

  const input = stripUndefined<Input>({
    upstreamKey: paramKey,
    key,
    label: startCase(paramKey),
    type,
    required: parameter.required,
    comments: parameter.description,
    default: parameter.schema?.default,
    example: parameter.schema?.example,
    model,
    clean: `(value) => util.types.${cleanFn}(value) || undefined`,
  });
  return input;
};

const getProperties = (
  schema: OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject
): Record<string, OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject> => {
  return merge(
    schema.properties ?? {},
    ...(schema.allOf ?? []).map((v) => (v as any).properties) // FIXME: any usage
  ) as Record<string, OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject>;
};

const buildBodyInputs = (
  schema: OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject,
  seenKeys: Set<string>
): Input[] => {
  const requiredKeys = new Set(schema.required ?? []);
  const properties = getProperties(schema);

  return Object.entries(properties).map<Input>(([propKey, prop]) => {
    const schemaType = prop?.type;
    const { type, cleanFn } =
      toInputType[schemaType as string] ?? toInputType["string"];

    const model = getInputModel(prop);

    const key = seenKeys.has(safeKey(propKey))
      ? safeKey(`other ${propKey}`)
      : safeKey(propKey);
    seenKeys.add(key);

    return stripUndefined<Input>({
      upstreamKey: propKey,
      key,
      label: startCase(propKey),
      type,
      required: requiredKeys.has(propKey),
      comments: prop.description,
      default: prop.default,
      example: prop.example,
      model,
      clean: `(value) => util.types.${cleanFn}(value) || undefined`,
    });
  });
};

export const getInputs = (
  operation: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject,
  sharedParameters: (
    | OpenAPIV3.ParameterObject
    | OpenAPIV3_1.ParameterObject
  )[] = []
): {
  pathInputs: Input[];
  queryInputs: Input[];
  bodyInputs: Input[];
  payloadContentType: string;
} => {
  if (
    typeof operation.requestBody !== "undefined" &&
    "$ref" in operation.requestBody
  ) {
    throw new Error("All refs should be resolved before computing Inputs.");
  }

  const seenKeys = new Set<string>(["connection"]);

  // Merge in Path Item level parameters with the specific parameters to this Operation.
  const parameters = [...sharedParameters, ...(operation.parameters ?? [])];

  const pathInputs = (parameters ?? [])
    .filter((p) => !("$ref" in p) && p.in === "path")
    .map((p) => buildInput(p, seenKeys));

  const queryInputs = (parameters ?? [])
    .filter((p) => !("$ref" in p) && p.in === "query")
    .map((p) => buildInput(p, seenKeys));

  const requestBodySchema =
    operation.requestBody?.content?.["application/json"]?.schema;
  if (typeof requestBodySchema !== "undefined" && "$ref" in requestBodySchema) {
    throw new Error("All refs should be resolved before computing Inputs.");
  }
  const bodyInputs =
    requestBodySchema === undefined
      ? []
      : buildBodyInputs(requestBodySchema, seenKeys);

  return {
    pathInputs,
    queryInputs,
    bodyInputs,
    payloadContentType: "application/json",
  };
};
