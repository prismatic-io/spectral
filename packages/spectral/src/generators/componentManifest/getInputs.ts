import { Input as ServerTypeInput } from "../../serverTypes";
import { InputFieldDefinition } from "../../types/Inputs";

export interface Input {
  key: string;
  label: string;
  type: InputType;
  required: boolean | undefined;
  properties: {
    key: keyof ServerTypeInput;
    value: string;
  }[];
}

export type InputType = string | { type: string; module: string };

interface GetInputsProps {
  inputs: ServerTypeInput[];
  documentProperties: (keyof ServerTypeInput)[];
}

export const getInputs = ({
  inputs,
  documentProperties,
}: GetInputsProps): Input[] => {
  return inputs.map((input) => {
    return {
      key: input.key,
      label: input.label,
      type: getInputType(input),
      required: input.required,
      collection: input.collection,
      inputType: input.type,
      onPremiseControlled: input.onPremiseControlled || input.onPremControlled,
      properties: documentProperties.reduce(
        (acc, key) => {
          const value = input[key]
            ? JSON.stringify(input[key])
                .replace(/(^"|"$)|(^'|'$)/g, "")
                .trim()
            : null;

          if (typeof value === "undefined" || value === null || value === "") {
            return acc;
          }

          return [
            ...acc,
            {
              key,
              value,
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

export const INPUT_TYPE_MAP: Record<InputFieldDefinition["type"], InputType> = {
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

const getInputType = (input: ServerTypeInput) => {
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
