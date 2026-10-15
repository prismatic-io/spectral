import type { CollectionType } from "../types/ConfigVars";
import type { Action, Input } from ".";
import { performActionFunctionExecutor } from "./actionExecutor";
import { requireContext } from "./asyncContext";
import { convertInputValue } from "./convertIntegration";

/** The erased form of a bundled action call; {@link ComponentClientAction} types it from the
 * action's definition. */
export type BundledAction = (values?: Record<string, unknown>) => Promise<unknown>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Resolves what a `structuredObject` / `dynamicObject` input's value should be
 * once child defaults are applied. An omitted container becomes an object of
 * its children's defaults; a partially supplied one keeps what the caller
 * gave and fills the rest, recursively. The platform always hands a `perform`
 * fully-populated containers, so a component may destructure them without
 * guarding, and the callable form must match. Collections apply the same
 * filling per element (`valuelist`) or per entry value (`keyvaluelist`). */
const withChildDefaults = (input: Input, value: unknown): unknown => {
  if (input.type === "structuredObject" && input.inputs) {
    const children = input.inputs;
    const fillRecord = (record: unknown) =>
      isPlainObject(record) ? fillDefaults(children, record) : record;
    if (input.collection === "valuelist") {
      return Array.isArray(value) ? value.map(fillRecord) : value;
    }
    if (input.collection === "keyvaluelist") {
      return Array.isArray(value)
        ? value.map((entry) =>
            isPlainObject(entry) && "value" in entry
              ? { ...entry, value: fillRecord(entry.value) }
              : entry,
          )
        : value;
    }
    return fillRecord(value ?? {});
  }

  if (input.type === "dynamicObject" && input.inputs && isPlainObject(value)) {
    const { configuration, values } = value;
    const selected =
      typeof configuration === "string"
        ? input.inputs.find((candidate) => candidate.key === configuration)
        : undefined;
    return selected?.inputs
      ? { ...value, values: fillDefaults(selected.inputs, isPlainObject(values) ? values : {}) }
      : value;
  }

  return value;
};

/** The platform hands a `boolean` input to `perform` as its serialized string, so a native
 * boolean passed at call time is serialized the same way (per element for collections) before
 * the component's cleaner sees it. */
const serializeBooleans = (input: Input, value: unknown): unknown => {
  if (input.type !== "boolean") {
    return value;
  }
  const serialize = (entry: unknown) => (typeof entry === "boolean" ? String(entry) : entry);
  if (input.collection === "valuelist") {
    return Array.isArray(value) ? value.map(serialize) : value;
  }
  if (input.collection === "keyvaluelist") {
    return Array.isArray(value)
      ? value.map((entry) =>
          isPlainObject(entry) && "value" in entry
            ? { ...entry, value: serialize(entry.value) }
            : entry,
        )
      : value;
  }
  return serialize(value);
};

const fillDefaults = (inputs: Input[], values: Record<string, unknown>): Record<string, unknown> =>
  inputs.reduce<Record<string, unknown>>((accumulator, input) => {
    const value = withChildDefaults(input, values[input.key] ?? input.default);
    accumulator[input.key] = serializeBooleans(
      input,
      convertInputValue(value, input.collection as CollectionType | undefined),
    );
    return accumulator;
  }, {});

/**
 * Makes a converted action callable in-process with just its input values. Resolves the acting
 * context ambiently via {@link requireContext}, fills in input defaults the way the platform
 * would, and runs the converted `perform` — which already applies the component's input
 * cleaners and error hook — through the same executor the runner uses for a registry-invoked
 * action, so results and errors look the same either way.
 */
export const createBundledAction =
  (action: Action): BundledAction =>
  async (values = {}) => {
    const context = requireContext();
    return performActionFunctionExecutor(
      action.perform,
      context,
      fillDefaults(action.inputs, values),
    );
  };
