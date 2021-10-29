import { ConditionalExpression } from "./conditional-logic";

/** InputField type enumeration. */
export type InputFieldType = keyof InputFieldTypeMap;

export type InputFieldTypeMap = {
  string: unknown;
  data: unknown;
  text: unknown;
  password: unknown;
  boolean: unknown;
  code: unknown;
  conditional: ConditionalExpression;
  connection: never;
};
