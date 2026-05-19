import type { Input as InputBase } from "../../serverTypes";
import type { InputFieldDefinition } from "../../types/Inputs";
import { escapeSpecialCharacters } from "../utils/escapeSpecialCharacters";
import { DOC_BLOCK_DEFAULT } from "./docBlock";

export type ServerTypeInput = InputBase & {
  onPremControlled?: boolean;
  shown?: boolean;
};

type ValueType = string | { type: string; import: string; module: string };

export interface Input {
  key: string;
  label: string;
  inputType: string;
  valueType: ValueType;
  docBlock: string;
  required: boolean | undefined;
  default: ServerTypeInput["default"];
}

interface GetInputsProps {
  inputs: ServerTypeInput[];
  docBlock?: (input: ServerTypeInput) => string;
}

export const getInputs = ({ inputs, docBlock = DOC_BLOCK_DEFAULT }: GetInputsProps): Input[] => {
  return inputs.reduce((acc, input) => {
    if (
      (typeof input.shown === "boolean" && input.shown === false) ||
      input.type === "dynamicObjectSelection" ||
      input.type === "dynamicFieldSelection"
    ) {
      return acc;
    }

    return [
      ...acc,
      {
        key: input.key,
        label: input.label,
        inputType: input.type,
        valueType: getInputValueType(input),
        required:
          input.required &&
          (input.default === undefined || input.default === null || input.default === ""),
        collection: input.collection,
        onPremControlled: input.onPremiseControlled || input.onPremControlled,
        docBlock: docBlock(input),
        default: getDefaultValue(input.default, Boolean(input.collection)),
      },
    ];
  }, [] as Input[]);
};

type InputType = string | { type: string; module: string };

export const INPUT_TYPE_MAP: Record<InputFieldDefinition["type"], InputType> = {
  string: "string",
  data: "string",
  text: "string",
  password: "string",
  boolean: "boolean",
  code: "string",
  conditional: {
    module: "@prismatic-io/spectral/dist/util",
    type: "ConditionalExpression",
  },
  connection: {
    module: "@prismatic-io/spectral/dist/types",
    type: "Connection",
  },
  objectSelection: {
    module: "@prismatic-io/spectral/dist/types",
    type: "ObjectSelection",
  },
  objectFieldMap: {
    module: "@prismatic-io/spectral/dist/types",
    type: "ObjectFieldMap",
  },
  jsonForm: {
    module: "@prismatic-io/spectral/dist/types",
    type: "JSONForm",
  },
  dynamicObjectSelection: "string",
  dynamicFieldSelection: "string",
  date: "string",
  timestamp: "string",
  flow: "string",
  template: "string",
  structuredObject: {
    module: "@prismatic-io/spectral/dist/types",
    type: "StructuredObject",
  },
  dynamicObject: {
    module: "@prismatic-io/spectral/dist/types",
    type: "DynamicObject",
  },
};

const getInputValueType = (input: ServerTypeInput): ValueType => {
  if (input.type === "structuredObject") {
    return structuredObjectTypeString(input.inputs ?? []);
  }

  if (input.type === "dynamicObject") {
    return dynamicObjectTypeString(input.inputs ?? []);
  }

  const inputType = INPUT_TYPE_MAP[input.type as InputFieldDefinition["type"]];

  const valueType = input.model
    ? input.model
        .map((choice) => {
          return `\`${choice.value.replaceAll("\r", "\\r").replaceAll("\n", "\\n")}\``;
        })
        .join(" | ")
    : inputType
      ? typeof inputType === "string"
        ? inputType
        : {
            ...inputType,
            import: inputType.type,
          }
      : "never";

  if (input.collection === "keyvaluelist") {
    return typeof valueType === "string"
      ? `Record<string, ${valueType}> | Array<{key: string, value: ${valueType}}>`
      : {
          ...valueType,
          type: `Record<string, ${valueType.type}> | Array<{key: string, value: ${valueType.type}}>`,
        };
  }

  if (input.collection === "valuelist") {
    return typeof valueType === "string"
      ? `Array<${valueType}>`
      : { ...valueType, type: `Array<${valueType.type}>` };
  }

  return valueType;
};

const getDefaultValue = (value: ServerTypeInput["default"], isCollection: boolean) => {
  if (value === undefined || value === "") {
    return isCollection ? [] : value;
  }

  const stringValue = typeof value === "string" ? value : JSON.stringify(value);

  return escapeSpecialCharacters(stringValue);
};

const isValidIdentifier = (key: string) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);

const wrapCollection = (valueType: string, collection: ServerTypeInput["collection"]): string => {
  if (collection === "valuelist") {
    return `Array<${valueType}>`;
  }
  if (collection === "keyvaluelist") {
    return `Record<string, ${valueType}> | Array<{key: string, value: ${valueType}}>`;
  }
  return valueType;
};

const getLeafBaseType = (child: ServerTypeInput): string => {
  if (child.model?.length) {
    return child.model
      .map(({ value }) => `\`${value.replaceAll("\r", "\\r").replaceAll("\n", "\\n")}\``)
      .join(" | ");
  }

  const mapped = INPUT_TYPE_MAP[child.type as InputFieldDefinition["type"]];

  if (!mapped) {
    return "unknown";
  }

  if (typeof mapped === "string") {
    return mapped;
  }

  return `import("${mapped.module}").${mapped.type}`;
};

const getLeafTypeString = (child: ServerTypeInput): string => {
  if (child.type === "structuredObject") {
    return structuredObjectTypeString(child.inputs ?? []);
  }

  return wrapCollection(getLeafBaseType(child), child.collection);
};

const SPECTRAL_TYPES_MODULE = "@prismatic-io/spectral/dist/types";

const structuredObjectTypeString = (inputs: ServerTypeInput[]): string => {
  if (!inputs.length) {
    return `import("${SPECTRAL_TYPES_MODULE}").StructuredObject`;
  }

  const fields = inputs
    .map((child) => {
      const key = isValidIdentifier(child.key) ? child.key : JSON.stringify(child.key);

      return `${key}: ${getLeafTypeString(child)}`;
    })
    .join("; ");

  return `{ ${fields} }`;
};

const dynamicObjectTypeString = (configurations: ServerTypeInput[]): string => {
  if (!configurations.length) {
    return `import("${SPECTRAL_TYPES_MODULE}").DynamicObject`;
  }

  return configurations
    .map((config) => {
      const valuesType = config.inputs?.length
        ? structuredObjectTypeString(config.inputs)
        : `import("${SPECTRAL_TYPES_MODULE}").StructuredObject`;

      return `{ configuration: ${JSON.stringify(config.key)}; values: ${valuesType} }`;
    })
    .join(" | ");
};
