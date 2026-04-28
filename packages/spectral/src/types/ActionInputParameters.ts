import type { ConditionalExpression } from "./conditional-logic";
import type {
  Connection,
  InputCleanFunction,
  InputFieldCollection,
  Inputs,
  KeyValuePair,
  StructuredObjectInputField,
} from "./Inputs";

/** Resolves a single InputFieldDefinition's runtime value type. structuredObject
 * resolves to `unknown` until the per-field record-type recursion lands. */
type InputValue<T> = T extends StructuredObjectInputField
  ? unknown
  : T extends { clean: InputCleanFunction<any> }
    ? ReturnType<T["clean"]>
    : T extends { type: "connection"; collection?: infer C }
      ? ExtractValue<Connection, C extends InputFieldCollection | undefined ? C : undefined>
      : T extends { type: "conditional"; collection?: infer C }
        ? ExtractValue<
            ConditionalExpression,
            C extends InputFieldCollection | undefined ? C : undefined
          >
        : T extends { default?: infer D; collection?: infer C }
          ? ExtractValue<D, C extends InputFieldCollection | undefined ? C : undefined>
          : unknown;

/**
 * Collection of input parameters.
 * Inputs can be static values, references to config variables, or
 * references to previous steps' outputs.
 */
export type ActionInputParameters<TInputs extends Inputs> = {
  [Property in keyof TInputs]: InputValue<TInputs[Property]>;
};

export type ExtractValue<
  TType,
  TCollection extends InputFieldCollection | undefined,
> = TCollection extends "keyvaluelist"
  ? KeyValuePair<TType>[]
  : TCollection extends "valuelist"
    ? TType[]
    : TType;
