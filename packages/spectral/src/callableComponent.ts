import cloneDeep from "lodash/cloneDeep";
import { requireContext } from "./serverTypes/asyncContext";
import { cleanerFor } from "./serverTypes/convertComponent";
import { cleanParams } from "./serverTypes/perform";
import {
  type ActionDefinition,
  type ComponentHooks,
  type ConditionalExpression,
  type Connection,
  InputFieldDefaultMap,
  type InputFieldDefinition,
  type Inputs,
  type JSONForm,
  type KeyValuePair,
  type ObjectFieldMap,
  type ObjectSelection,
} from "./types";

export type ActionMap = Record<string, ActionDefinition<any, any, boolean, any>>;

/** Shared by separately bundled copies; never included in platform serialization. */
export const authoringSymbol: unique symbol = Symbol.for("@prismatic-io/spectral/authoring/v1");

export interface AuthoringDefinition<TActions extends ActionMap> {
  actions: TActions;
  hooks?: ComponentHooks;
}

export interface AuthoringCarrier<TActions extends ActionMap> {
  readonly [authoringSymbol]: AuthoringDefinition<TActions>;
}

/** Retains the inferred authoring surface without changing the enumerable server surface. */
export const retainAuthoring = <TTarget extends object, TActions extends ActionMap>(
  target: TTarget,
  definition: AuthoringDefinition<TActions>,
): TTarget & AuthoringCarrier<TActions> => {
  Object.defineProperty(target, authoringSymbol, { value: definition });
  return target as TTarget & AuthoringCarrier<TActions>;
};

type CollectionValue<TInput, TValue> = TInput extends { collection: "valuelist" }
  ? TValue[]
  : TInput extends { collection: "keyvaluelist" }
    ? KeyValuePair<TValue>[] | Record<string, TValue>
    : TValue;

/** Values supplied by a caller, before a component's cleaners transform them. */
type CallableInputValue<TInput> = TInput extends {
  type: "structuredObject";
  inputs: infer TInputs extends Inputs;
}
  ? CollectionValue<TInput, CallableInputs<TInputs>>
  : TInput extends {
        type: "dynamicObject";
        configurations: infer TConfigurations extends Record<string, { inputs: Inputs }>;
      }
    ? {
        [K in keyof TConfigurations]: {
          configuration: K;
          values: CallableInputs<TConfigurations[K]["inputs"]>;
        };
      }[keyof TConfigurations]
    : CollectionValue<
        TInput,
        TInput extends { type: "connection" }
          ? Connection
          : TInput extends { type: "number" | "float" }
            ? number | string
            : TInput extends { type: "boolean" }
              ? boolean | string
              : TInput extends { type: "conditional" }
                ? ConditionalExpression
                : TInput extends { type: "objectSelection" }
                  ? ObjectSelection
                  : TInput extends { type: "objectFieldMap" }
                    ? ObjectFieldMap
                    : TInput extends { type: "jsonForm" }
                      ? JSONForm
                      : TInput extends {
                            type: "data" | "dynamicObjectSelection" | "dynamicFieldSelection";
                          }
                        ? TInput extends { clean: (value: never) => unknown }
                          ? unknown
                          : string
                        : string
      >;

type RequiredInputKeys<TInputs extends Inputs> = {
  [K in keyof TInputs]: TInputs[K] extends { required: true }
    ? TInputs[K] extends { default: unknown }
      ? never
      : K
    : never;
}[keyof TInputs];

export type CallableInputs<TInputs extends Inputs> = {
  [K in RequiredInputKeys<TInputs>]: CallableInputValue<TInputs[K]>;
} & {
  [K in Exclude<keyof TInputs, RequiredInputKeys<TInputs>>]?: CallableInputValue<TInputs[K]>;
};

export type CallableComponent<TActions extends ActionMap> = {
  actions: {
    [K in keyof TActions]: (
      ...args: RequiredInputKeys<TActions[K]["inputs"]> extends never
        ? [values?: CallableInputs<TActions[K]["inputs"]>]
        : [values: CallableInputs<TActions[K]["inputs"]>]
    ) => ReturnType<TActions[K]["perform"]>;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Default only undefined values: explicit null remains available to custom cleaners. */
const prepareValue = (input: InputFieldDefinition, supplied: unknown): unknown => {
  let value =
    supplied === undefined
      ? cloneDeep(
          ("default" in input ? input.default : undefined) ??
            ("collection" in input && input.collection ? [] : InputFieldDefaultMap[input.type]),
        )
      : supplied;

  if ("collection" in input && input.collection === "keyvaluelist" && isRecord(value)) {
    value = Object.entries(value).map(([key, value]) => ({ key, value }));
  }

  // An uncleaned boolean's authoring contract is its serialized string value. Accept
  // native booleans at the call site without passing a boolean to a string-typed perform.
  // Explicit cleaners still receive the original value and decide how to transform it.
  if (input.type === "boolean" && !input.clean) {
    const serialize = (entry: unknown) => (typeof entry === "boolean" ? String(entry) : entry);
    if (input.collection === "valuelist") {
      return Array.isArray(value) ? value.map(serialize) : value;
    }
    if (input.collection === "keyvaluelist") {
      return Array.isArray(value)
        ? value.map((entry) =>
            isRecord(entry) && "value" in entry
              ? { ...entry, value: serialize(entry.value) }
              : entry,
          )
        : value;
    }
    return serialize(value);
  }

  if (input.type === "structuredObject") {
    const prepareRecord = (entry: unknown) =>
      isRecord(entry) ? prepareInputs(input.inputs, entry) : entry;
    if (input.collection === "valuelist") {
      return Array.isArray(value) ? value.map(prepareRecord) : value;
    }
    if (input.collection === "keyvaluelist") {
      return Array.isArray(value)
        ? value.map((entry) =>
            isRecord(entry) && "value" in entry
              ? { ...entry, value: prepareRecord(entry.value) }
              : entry,
          )
        : value;
    }
    return prepareRecord(value === undefined ? {} : value);
  }

  if (input.type === "dynamicObject" && isRecord(value)) {
    const configuration =
      typeof value.configuration === "string"
        ? input.configurations[value.configuration]
        : undefined;
    if (configuration && isRecord(value.values)) {
      return { ...value, values: prepareInputs(configuration.inputs, value.values) };
    }
  }
  return value;
};

const prepareInputs = (
  inputs: Inputs,
  supplied: Record<string, unknown>,
): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(inputs).map(([key, definition]) => [
      key,
      prepareValue(definition, supplied[key]),
    ]),
  );
};

/**
 * Creates local action calls from an authored component. Calls execute in the current CNI
 * context and preserve the perform result envelope; they do not create platform steps.
 */
export const callableComponent = <TActions extends ActionMap>(
  source: AuthoringCarrier<TActions> | AuthoringDefinition<TActions>,
): CallableComponent<TActions> => {
  const definition = authoringSymbol in source ? source[authoringSymbol] : source;
  if (
    !definition.actions ||
    Object.values(definition.actions).some(
      (action) =>
        !action.inputs || Array.isArray(action.inputs) || typeof action.perform !== "function",
    )
  ) {
    throw new Error(
      "callableComponent requires authoring definitions or a component created with a supporting " +
        "version of Spectral. Pass the original component; spreading or serializing it loses authoring data.",
    );
  }
  const actions = Object.fromEntries(
    Object.entries(definition.actions).map(([key, action]) => {
      const cleaners = Object.fromEntries(
        Object.entries(action.inputs as Inputs).map(([key, input]) => [key, cleanerFor(input)]),
      );
      return [
        key,
        async (values: Record<string, unknown> = {}) => {
          // Missing context is a usage error, not a component perform failure.
          const context = requireContext();
          try {
            const params = cleanParams(prepareInputs(action.inputs, values), cleaners);
            return await action.perform(context, params);
          } catch (error) {
            throw definition.hooks?.error ? await definition.hooks.error(error) : error;
          }
        },
      ];
    }),
  );
  // Object.fromEntries erases the keys and per-action return types, which this wrapper preserves.
  return { actions } as unknown as CallableComponent<TActions>;
};
