import type { ConditionalExpression } from "./conditional-logic";
import type {
  Connection,
  DynamicObjectInputField,
  InputCleanFunction,
  InputFieldCollection,
  Inputs,
  KeyValuePair,
  StructuredObjectInputField,
} from "./Inputs";

/** Resolves a single InputFieldDefinition's runtime value type.
 * - structuredObject: record of declared children's resolved value types;
 *   with `collection` set, a list (`valuelist`) or `KeyValuePair` list
 *   (`keyvaluelist`) of that record.
 * - dynamicObject: discriminated union keyed by the selected configuration,
 *   with the configuration's resolved inputs nested under `values` to avoid
 *   collisions with the `configuration` discriminant key.
 * The depth caps (`LeafInputFieldDefinition`, `StructuredOrLeafInputFieldDefinition`)
 * prevent unbounded recursion. */
type InputValue<T> = T extends StructuredObjectInputField
  ? ExtractValue<{ [K in keyof T["inputs"]]: InputValue<T["inputs"][K]> }, T["collection"]>
  : T extends DynamicObjectInputField
    ? {
        [C in keyof T["configurations"]]: {
          configuration: C;
          values: {
            [K in keyof T["configurations"][C]["inputs"]]: InputValue<
              T["configurations"][C]["inputs"][K]
            >;
          };
        };
      }[keyof T["configurations"]]
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
