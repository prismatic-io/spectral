import { ServerTypeInput } from "./getInputs";

export const DOC_BLOCK_DEFAULT = (input: ServerTypeInput): string => {
  const comments = addPunctuation(input.comments);
  const onPrem =
    input.onPremControlled || input.onPremiseControlled
      ? " This input will be supplied when using an on prem resource."
      : "";

  return (
    addLine({ raw: "/**" }) +
    addLine({ value: input.label }) +
    addLine({ value: comments + onPrem }) +
    addLine({ raw: "*" }) +
    addLine({ key: "default", value: input.default }) +
    addLine({ key: "example", value: input.example }) +
    addLine({ key: "placeholder", value: input.placeholder }) +
    addLine({ raw: "*/" })
  );
};

interface AddLineProps {
  key?: string;
  value?: string | unknown | undefined | null;
  raw?: string;
}

export const addLine = ({ key, value, raw }: AddLineProps) => {
  if (raw) {
    return ` ${raw}\n`;
  }

  if (typeof value === "undefined" || value === null || value === "") {
    return "";
  }

  const sanitizedValue = JSON.stringify(value)
    .replace(/(^"|"$)|(^'|'$)/g, "")
    .trim();

  return ` * ${key ? `@${key} ${sanitizedValue}` : sanitizedValue}\n`;
};

export const addPunctuation = (value: string | undefined): string => {
  if (typeof value === "undefined" || value === null || value === "") {
    return "";
  }

  return value.endsWith(".") || value.endsWith("!") || value.endsWith("?")
    ? value
    : value + ".";
};
