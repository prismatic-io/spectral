import type { ConditionalExpression } from "./conditional-logic";
import type {
  Connection,
  InputCleanFunction,
  InputFieldCollection,
  Inputs,
  KeyValuePair,
  StructuredObjectInputField,
} from "./Inputs";

/** Resolves a single InputFieldDefinition's runtime value type. A structuredObject
 * resolves to a record of its declared children's resolved value types; the
 * depth-1 nesting cap (`LeafInputFieldDefinition`) prevents unbounded recursion. */
type InputValue<T> = T extends StructuredObjectInputField
  ? { [K in keyof T["inputs"]]: InputValue<T["inputs"][K]> }
  : T extends { clean: InputCleanFunction<any> }
    ? ReturnType<T["clean"]>
    : T extends { type: "connection"; collection?: InputFieldCollection }
      ? ExtractValue<Connection, T["collection"]>
      : T extends { type: "conditional"; collection?: InputFieldCollection }
        ? ExtractValue<ConditionalExpression, T["collection"]>
        : T extends { default?: unknown; collection?: InputFieldCollection }
          ? ExtractValue<T["default"], T["collection"]>
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
