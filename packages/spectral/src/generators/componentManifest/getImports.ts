import type { Input } from "./getInputs";

export type Imports = Record<string, string[]>;

interface GetImportsProps {
  inputs: Input[];
}

export const getImports = ({ inputs }: GetImportsProps) => {
  return inputs.reduce((acc, input) => {
    if (typeof input.type === "string") {
      return acc;
    }

    return {
      ...acc,
      [input.type.module]: acc[input.type.module]
        ? !acc[input.type.module].includes(input.type.type)
          ? [...acc[input.type.module], input.type.type]
          : acc[input.type.module]
        : [input.type.type],
    };
  }, {} as Imports);
};
