import type { Input } from "./getInputs";

export type Imports = Record<string, string[]>;

interface GetImportsProps {
  inputs: Input[];
  additionalImports?: Imports;
}

export const getImports = ({ inputs, additionalImports = {} }: GetImportsProps) => {
  const baseImports = { ...additionalImports };

  return inputs.reduce((acc, input) => {
    if (typeof input.valueType === "string") {
      return acc;
    }

    return {
      ...acc,
      [input.valueType.module]: acc[input.valueType.module]
        ? !acc[input.valueType.module].includes(input.valueType.import)
          ? [...acc[input.valueType.module], input.valueType.import]
          : acc[input.valueType.module]
        : [input.valueType.import],
    };
  }, baseImports as Imports);
};
