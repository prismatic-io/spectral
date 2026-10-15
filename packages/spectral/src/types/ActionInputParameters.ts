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
export type InputValue<T> = T extends StructuredObjectInputField
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
          : T extends { type: "number" | "float"; collection?: InputFieldCollection }
            ? ExtractValue<number, T["collection"]>
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

type OptionalClientInputKey<TInputs> = {
  [Property in keyof TInputs]: TInputs[Property] extends { required: true }
    ? TInputs[Property] extends { default: unknown }
      ? Property
      : never
    : Property;
}[keyof TInputs];

type ComponentClientInputValues<TInputs> = {
  [Property in Exclude<keyof TInputs, OptionalClientInputKey<TInputs>>]: ComponentClientInputValue<
    TInputs[Property]
  >;
} & {
  [Property in OptionalClientInputKey<TInputs>]?: ComponentClientInputValue<TInputs[Property]>;
};

type ComponentClientInputValue<T> = T extends StructuredObjectInputField
  ? ExtractValue<ComponentClientInputValues<T["inputs"]>, T["collection"]>
  : T extends DynamicObjectInputField
    ? {
        [C in keyof T["configurations"]]: {
          configuration: C;
          values: ComponentClientInputValues<T["configurations"][C]["inputs"]>;
        };
      }[keyof T["configurations"]]
    : InputValue<T>;

/** Values accepted by an action on an npm component client. Required inputs
 * stay required, while optional and defaulted inputs may be omitted. */
export type ComponentClientActionInputParameters<TInputs extends Inputs> = 0 extends 1 & TInputs
  ? Record<string, unknown>
  : ComponentClientInputValues<TInputs>;
