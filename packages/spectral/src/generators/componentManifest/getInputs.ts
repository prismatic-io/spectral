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

const getDefaultValue = (value: ServerTypeInput["default"]) => {
  if (value === undefined || value === "") {
    return value;
  }

  const stringValue = typeof value === "string" ? value : JSON.stringify(value);
  return escapeSpecialCharacters(stringValue);
};

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
        required: input.required && (input.default === undefined || input.default === ""),
        collection: input.collection,
        onPremControlled: input.onPremiseControlled || input.onPremControlled,
        docBlock: docBlock(input),
        default: getDefaultValue(input.default),
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
    module: "@prismatic-io/spectral/util",
    type: "ConditionalExpression",
  },
  connection: {
    module: "@prismatic-io/spectral/types",
    type: "Connection",
  },
  objectSelection: {
    module: "@prismatic-io/spectral/types",
    type: "ObjectSelection",
  },
  objectFieldMap: {
    module: "@prismatic-io/spectral/types",
    type: "ObjectFieldMap",
  },
  jsonForm: {
    module: "@prismatic-io/spectral/types",
    type: "JSONForm",
  },
  dynamicObjectSelection: "string",
  dynamicFieldSelection: "string",
  date: "string",
  timestamp: "string",
  flow: "string",
  template: "string",
};

const getInputValueType = (input: ServerTypeInput): ValueType => {
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
