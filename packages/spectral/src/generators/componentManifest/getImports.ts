import type { Input } from "./getInputs";

export type Imports = Record<string, string[]>;

interface GetImportsProps {
  inputs: Input[];
}

export const getImports = ({ inputs }: GetImportsProps) => {
  return inputs.reduce((acc, input) => {
    if (typeof input.valueType === "string") {
      return acc;
    }

    return {
      ...acc,
      [input.valueType.module]: acc[input.valueType.module]
        ? !acc[input.valueType.module].includes(input.valueType.type)
          ? [...acc[input.valueType.module], input.valueType.type]
          : acc[input.valueType.module]
        : [input.valueType.type],
    };
  }, {} as Imports);
};
