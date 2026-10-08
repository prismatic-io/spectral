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

/** Input keys a caller may omit when invoking an action directly: anything not
 * declared `required: true`, plus anything with a `default` (which fills in for
 * an omitted value at call time). */
type OptionalCallableInputKey<TInputs extends Inputs> = {
  [Property in keyof TInputs]: TInputs[Property] extends { required: true }
    ? TInputs[Property] extends { default: unknown }
      ? Property
      : never
    : Property;
}[keyof TInputs];

/**
 * The values accepted by a directly-callable action (an action imported from an
 * npm-published component and invoked as a function, e.g.
 * `googleDrive.actions.listFolders({ connection })`).
 *
 * Unlike {@link ActionInputParameters}, which describes what `perform` receives
 * (every input, already cleaned and defaulted), this describes what the caller
 * must supply: inputs that are not `required: true`, or that carry a `default`,
 * may be left out and are filled in with their default at call time.
 */
export type CallableActionInputParameters<TInputs extends Inputs> = 0 extends 1 & TInputs
  ? // `any` inputs (e.g. the `AnyActionDefinition` bound): nothing to split on.
    Record<string, unknown>
  : {
      [Property in Exclude<keyof TInputs, OptionalCallableInputKey<TInputs>>]: InputValue<
        TInputs[Property]
      >;
    } & {
      [Property in OptionalCallableInputKey<TInputs>]?: InputValue<TInputs[Property]>;
    };
