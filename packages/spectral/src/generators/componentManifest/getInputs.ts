import type { Input as InputBase } from "../../serverTypes";
import type { InputFieldDefinition } from "../../types/Inputs";

type ServerTypeInput = InputBase & {
  onPremControlled?: boolean;
};

export interface Input {
  key: string;
  label: string;
  inputType: string;
  valueType: ValueType;
  required: boolean | undefined;
  properties: {
    key: keyof ServerTypeInput;
    value: string;
  }[];
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
  docBlock: DocBlock;
}

export const getInputs = ({ inputs, docBlock }: GetInputsProps): Input[] => {
  return inputs.map((input) => {
    return {
      key: input.key,
      label: input.label,
      inputType: input.type,
      valueType: getInputValueType(input),
      required: input.required,
      collection: input.collection,
      onPremControlled: input.onPremiseControlled || input.onPremControlled,
      properties: docBlock.reduce(
        (acc, { propertyKey, inputKey, propertyValue, output }) => {
          if (inputKey && inputKey !== input.key) {
            return acc;
          }

          if (
            output &&
            (input[propertyKey] === propertyValue ||
              typeof propertyValue === "undefined")
          ) {
            return [
              ...acc,
              {
                key: propertyKey,
                value: output,
              },
            ];
          }

          if (
            typeof input[propertyKey] === "undefined" ||
            input[propertyKey] === null ||
            input[propertyKey] === "" ||
            (typeof propertyValue !== "undefined" &&
              input[propertyKey] !== propertyValue)
          ) {
            return acc;
          }

          return [
            ...acc,
            {
              key: propertyKey,
              value: JSON.stringify(input[propertyKey])
                .replace(/(^"|"$)|(^'|'$)/g, "")
                .trim(),
            },
          ];
        },
        [] as {
          key: keyof ServerTypeInput;
          value: string;
        }[]
      ),
    };
  });
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
    return `Record<string, ${valueType}>`;
  }

  if (input.collection === "valuelist") {
    return `${valueType}[]`;
  }

  return valueType;
};
