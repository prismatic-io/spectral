import type { Input as InputBase } from "../../serverTypes";
import type { InputFieldDefinition } from "../../types/Inputs";
import { DOC_BLOCK_DEFAULT } from "./docBlock";

export type ServerTypeInput = InputBase & {
  onPremControlled?: boolean;
  shown?: boolean;
};

export interface Input {
  key: string;
  label: string;
  inputType: string;
  valueType: ValueType;
  docBlock: string;
  required: boolean | undefined;
}

export type ValueType = string | { type: string; module: string };

export type DocBlock = {
  inputKey?: string;
  propertyKey: keyof ServerTypeInput;
  propertyValue?: unknown;
  output?: string;
}[];

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
        required: input.required && (input.default === undefined || input.default === ""),
        collection: input.collection,
        onPremControlled: input.onPremiseControlled || input.onPremControlled,
        docBlock: docBlock(input),
      },
    ];
  }, [] as Input[]);
};

export const INPUT_TYPE_MAP: Record<InputFieldDefinition["type"], ValueType> = {
  string: "string",
  data: "string",
  text: "string",
  password: "string",
  boolean: "boolean",
  code: "string",
  conditional: {
    type: "ConditionalExpression",
    module: "@prismatic-io/spectral",
  },
  connection: {
    type: "Connection",
    module: "@prismatic-io/spectral",
  },
  objectSelection: {
    type: "ObjectSelection",
    module: "@prismatic-io/spectral",
  },
  objectFieldMap: {
    type: "ObjectFieldMap",
    module: "@prismatic-io/spectral",
  },
  jsonForm: {
    type: "JSONForm",
    module: "@prismatic-io/spectral",
  },
  dynamicObjectSelection: "string",
  dynamicFieldSelection: "string",
};

const getInputValueType = (input: ServerTypeInput) => {
  const valueType = input.model
    ? input.model.map((choice) => `"${choice.value}"`).join(" | ")
    : INPUT_TYPE_MAP[input.type as InputFieldDefinition["type"]] || "never";

  if (input.collection === "keyvaluelist") {
    return `Record<string, ${valueType}> | Array<{key: string, value: ${valueType}}>`;
  }

  if (input.collection === "valuelist") {
    return `${valueType}[]`;
  }

  return valueType;
};
