import {
  ConditionalExpression,
  Inputs,
  InputFieldCollection,
  InputCleanFunction,
  Connection,
  KeyValuePair,
} from ".";

/**
 * Collection of input parameters.
 * Inputs can be static values, references to config variables, or
 * references to previous steps' outputs.
 */
export type ActionInputParameters<TInputs extends Inputs> = {
  [Property in keyof TInputs]: TInputs[Property]["clean"] extends InputCleanFunction<any>
    ? ReturnType<TInputs[Property]["clean"]>
    : TInputs[Property]["type"] extends "connection"
      ? ExtractValue<Connection, TInputs[Property]["collection"]>
      : TInputs[Property]["type"] extends "conditional"
        ? ExtractValue<ConditionalExpression, TInputs[Property]["collection"]>
        : ExtractValue<TInputs[Property]["default"], TInputs[Property]["collection"]>;
};

export type ExtractValue<
  TType,
  TCollection extends InputFieldCollection | undefined,
> = TCollection extends "keyvaluelist"
  ? KeyValuePair<TType>[]
  : TCollection extends "valuelist"
    ? TType[]
    : TType;
