import type { ConditionalExpression } from "./conditional-logic";
import type {
  Connection,
  DynamicObjectInputField,
  InputCleanFunction,
  InputFieldCollection,
  Inputs,
  JSONForm,
  KeyValuePair,
  ObjectFieldMap,
  ObjectSelection,
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

/** Input keys a caller may omit when invoking an action directly: anything not
 * declared `required: true`, plus anything with a `default` (which fills in for
 * an omitted value at call time). */
type OptionalCallableInputKey<TInputs> = {
  [Property in keyof TInputs]: TInputs[Property] extends { required: true }
    ? TInputs[Property] extends { default: unknown }
      ? Property
      : never
    : Property;
}[keyof TInputs];

/** {@link ActionInputParameters} for a directly-callable action: the same
 * per-input value types, with the keys a caller may omit made optional, applied
 * recursively through `structuredObject` children and `dynamicObject`
 * configuration values. */
type CallableInputValues<TInputs> = {
  [Property in Exclude<keyof TInputs, OptionalCallableInputKey<TInputs>>]: CallableInputValue<
    TInputs[Property]
  >;
} & {
  [Property in OptionalCallableInputKey<TInputs>]?: CallableInputValue<TInputs[Property]>;
};

/**
 * What a caller may pass for one leaf input, before the component's cleaner runs. This is the
 * caller's side of the contract, so it describes raw values: the platform hands a component
 * strings for most inputs, so a `number` or `boolean` input also accepts the native value,
 * which is serialized the way the platform would have. Inputs with structured values
 * (`connection`, `conditional`, selections, forms) take those structures. A cleaned `data` or
 * dynamic-selection input accepts anything, since only its cleaner knows.
 */
type CallableLeafValue<T> = T extends { type: "connection" }
  ? Connection
  : T extends { type: "conditional" }
    ? ConditionalExpression
    : T extends { type: "number" | "float" }
      ? number | string
      : T extends { type: "boolean" }
        ? boolean | string
        : T extends { type: "objectSelection" }
          ? ObjectSelection
          : T extends { type: "objectFieldMap" }
            ? ObjectFieldMap
            : T extends { type: "jsonForm" }
              ? JSONForm
              : T extends { type: "data" | "dynamicObjectSelection" | "dynamicFieldSelection" }
                ? T extends { clean: InputCleanFunction<any> }
                  ? unknown
                  : string
                : string;

/** A leaf input's caller value with its collection applied: a `keyvaluelist` also accepts a
 * plain record, which is normalized to key/value pairs at call time. */
type CallableCollectionValue<T> = T extends { collection: "valuelist" }
  ? CallableLeafValue<T>[]
  : T extends { collection: "keyvaluelist" }
    ? KeyValuePair<CallableLeafValue<T>>[] | Record<string, CallableLeafValue<T>>
    : CallableLeafValue<T>;

/** {@link CallableLeafValue} per input: containers resolve to {@link CallableInputValues} of
 * their children so optional children stay optional. */
type CallableInputValue<T> = T extends StructuredObjectInputField
  ? ExtractValue<CallableInputValues<T["inputs"]>, T["collection"]>
  : T extends DynamicObjectInputField
    ? {
        [C in keyof T["configurations"]]: {
          configuration: C;
          values: CallableInputValues<T["configurations"][C]["inputs"]>;
        };
      }[keyof T["configurations"]]
    : CallableCollectionValue<T>;

/**
 * The values accepted by a directly-callable action (an action imported from an
 * npm-published component and invoked as a function, e.g.
 * `googleDrive.actions.listFolders({ connection })`).
 *
 * Unlike {@link ActionInputParameters}, which describes what `perform` receives
 * (every input, already cleaned and defaulted), this describes what the caller
 * must supply: inputs that are not `required: true`, or that carry a `default`,
 * may be left out and are filled in with their default at call time. The same
 * applies to the children of a `structuredObject` and to the `values` of a
 * `dynamicObject` configuration.
 */
export type CallableActionInputParameters<TInputs extends Inputs> = 0 extends 1 & TInputs
  ? // `any` inputs: nothing to split on.
    Record<string, unknown>
  : CallableInputValues<TInputs>;
