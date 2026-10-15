import type {
  ActionDefinition,
  CallableActionInputParameters,
  ComponentDefinition,
  ComponentReference,
  NpmConnectionReferenceConfigVar,
  NpmDataSourceReferenceConfigVar,
} from "../types";
import type { CollectionType } from "../types/ConfigVars";
import type { Action, AnyTrigger, Component, Input } from ".";
import { performActionFunctionExecutor } from "./actionExecutor";
import { requireContext } from "./asyncContext";
import { type CallableConnectionConfigVar, createCallableConnection } from "./callableConnection";
import { type CallableDataSourceConfigVar, createCallableDataSource } from "./callableDataSource";
import { createCallableTrigger, type NpmTriggerReference } from "./callableTrigger";
import { convertInputValue } from "./convertIntegration";

/** An action helper, directly callable with just its input values
 * (e.g. `slack.actions.postMessage({ ... })`). Resolves the acting context
 * ambiently via {@link requireContext}, so it only works while running
 * inside a flow step (which establishes that context via `runWithContext`).
 * The server-facing {@link Action} remains separately available on the npm
 * component artifact's `component` property. */
export type AnyCallableAction = (values: Record<string, unknown>) => Promise<unknown>;

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

const fillDefaults = (inputs: Input[], values: Record<string, unknown>): Record<string, unknown> =>
  inputs.reduce<Record<string, unknown>>((accumulator, input) => {
    const value = withChildDefaults(input, values[input.key] ?? input.default);
    accumulator[input.key] = convertInputValue(
      value,
      input.collection as CollectionType | undefined,
    );
    return accumulator;
  }, {});

export const createCallableAction =
  (action: Action): AnyCallableAction =>
  async (values: Record<string, unknown> = {}) => {
    const context = requireContext();
    const filledValues = fillDefaults(action.inputs, values);
    return performActionFunctionExecutor(action.perform, context, filledValues);
  };

/** The directly-callable form of an action, typed from the original
 * `ActionDefinition` rather than from the converted `perform`. Only the
 * definition still carries each input's `required` and `default`; the converted
 * `perform` has already flattened them into plain value types. Reading them from
 * the definition is what lets inputs that aren't `required: true` (or that have
 * a `default`) be optional to the caller — see
 * {@link CallableActionInputParameters} — while the return type stays the
 * `perform`'s own. This is what the consumer-facing side of
 * `npmComponent(definition)` exposes. */
export type CallableAction<TDef> =
  TDef extends ActionDefinition<
    infer TInputs,
    infer _TConfigVars,
    infer _TAllowsBranching,
    infer TReturn
  >
    ? (params: CallableActionInputParameters<TInputs>) => Promise<TReturn>
    : never;

/**
 * The consumer-facing half of an npm component artifact. Its platform-facing
 * component remains a separate normal {@link Component} under `component`.
 */
/** A trigger reference helper, directly callable with its `values` (e.g.
 * `slack.triggers.webhook({ ... })`), produced by {@link createCallableTrigger}. */
export type CallableTriggerHelper<TTrigger> = (
  values?: ComponentReference["values"],
) => NpmTriggerReference<TTrigger>;

/** A data source reference helper, directly callable with the config var it should back (e.g.
 * `foo.dataSources.selectChannels({ stableKey: "...", values: { ... } })`), produced by
 * {@link createCallableDataSource}. */
export type CallableDataSourceHelper = (
  configVar: CallableDataSourceConfigVar,
) => NpmDataSourceReferenceConfigVar;

/** A connection reference helper, directly callable with the config var it should back (e.g.
 * `foo.connections.oauth2({ stableKey: "...", values: { ... } })`), produced by
 * {@link createCallableConnection}. */
export type CallableConnectionHelper = (
  configVar: CallableConnectionConfigVar,
) => NpmConnectionReferenceConfigVar;

export type NpmComponent<TDefinition extends ComponentDefinition<boolean, string>> = {
  readonly __prismaticNpmComponent: true;
  readonly component: Component;
  actions: {
    [K in keyof NonNullable<TDefinition["actions"]>]: CallableAction<
      NonNullable<TDefinition["actions"]>[K]
    >;
  };
  triggers: {
    [K in keyof NonNullable<TDefinition["triggers"]>]: CallableTriggerHelper<AnyTrigger>;
  };
  dataSources: {
    [K in keyof NonNullable<TDefinition["dataSources"]>]: CallableDataSourceHelper;
  };
  connections: {
    [C in NonNullable<TDefinition["connections"]>[number] as C["key"]]: CallableConnectionHelper;
  };
};

export type AnyNpmComponent = NpmComponent<ComponentDefinition<boolean, string>>;

export const isNpmComponent = (value: unknown): value is AnyNpmComponent =>
  typeof value === "object" &&
  value !== null &&
  "__prismaticNpmComponent" in value &&
  value.__prismaticNpmComponent === true &&
  "component" in value;

export const createNpmComponent = <TDefinition extends ComponentDefinition<boolean, string>>(
  component: Component,
): NpmComponent<TDefinition> => {
  const actions = Object.entries(component.actions).reduce<Record<string, AnyCallableAction>>(
    (result, [key, action]) => {
      result[key] = createCallableAction(action);
      return result;
    },
    {},
  );

  const triggers = Object.entries(component.triggers ?? {}).reduce<
    Record<string, CallableTriggerHelper<unknown>>
  >((result, [key, trigger]) => {
    result[key] = createCallableTrigger(trigger, component.dataSources ?? {});
    return result;
  }, {});

  const dataSources = Object.entries(component.dataSources ?? {}).reduce<
    Record<string, CallableDataSourceHelper>
  >((result, [key, dataSource]) => {
    result[key] = createCallableDataSource(dataSource, component.dataSources ?? {});
    return result;
  }, {});

  const connections = (component.connections ?? []).reduce<
    Record<string, CallableConnectionHelper>
  >((result, connection) => {
    result[connection.key] = createCallableConnection(connection);
    return result;
  }, {});

  return {
    __prismaticNpmComponent: true,
    component,
    actions,
    triggers,
    dataSources,
    connections,
  } as NpmComponent<TDefinition>;
};
