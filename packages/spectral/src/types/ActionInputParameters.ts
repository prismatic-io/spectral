import type { ConditionalExpression } from "./conditional-logic";
import type {
  Connection,
  InputCleanFunction,
  InputFieldCollection,
  Inputs,
  KeyValuePair,
  StructuredObjectInputField,
} from "./Inputs";

/**
 * Resolves a single InputFieldDefinition's runtime value type.
 *
 * StructuredObject is dispatched first so the rest of the chain doesn't try
 * to index `clean`/`default`/`collection` against a member of the union that
 * lacks them. The runtime value for a structuredObject is a record of
 * resolved child values; emitting a precise typed record (matching the
 * declared children) is a follow-up to this work. Until that lands,
 * `unknown` is the safe fallback so the union of all per-field resolutions
 * still simplifies to `unknown` and doesn't break code that passes around a
 * generic `ActionInputParameters<Inputs>`.
 */
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
