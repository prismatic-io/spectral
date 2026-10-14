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

/** A converted {@link Action}, directly callable with just its input values
 * (e.g. `slack.actions.postMessage({ ... })`). Resolves the acting context
 * ambiently via {@link requireContext}, so it only works while running
 * inside a flow step (which establishes that context via `runWithContext`).
 * All of the `Action` data properties (`key`, `inputs`, `perform`, ...) are
 * still present on it, for the runner and other existing consumers that
 * invoke `.perform(context, params)` directly.
 *
 * This is the erased form; {@link CallableAction} types the call from the
 * action's own definition. */
export type AnyCallableAction = Action & ((values: Record<string, unknown>) => Promise<unknown>);

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

export const createCallableAction = (action: Action): AnyCallableAction => {
  const callable = async (values: Record<string, unknown> = {}) => {
    const context = requireContext();
    const filledValues = fillDefaults(action.inputs, values);
    return performActionFunctionExecutor(action.perform, context, filledValues);
  };

  return Object.assign(callable, action);
};

/**
 * The directly-callable form of an action, typed from its {@link ActionDefinition}:
 * the erased {@link Action} (for the runner and anything else that calls
 * `.perform(context, params)`), plus a call signature that takes only the input
 * values. Inputs that aren't `required: true`, or that carry a `default`, are
 * optional to the caller — see {@link CallableActionInputParameters} — and the
 * return type is the definition's own.
 */
export type CallableAction<TDefinition> =
  TDefinition extends ActionDefinition<
    infer TInputs,
    infer _TConfigVars,
    infer _TAllowsBranching,
    infer TReturn
  >
    ? Action & ((params: CallableActionInputParameters<TInputs>) => Promise<TReturn>)
    : never;

/**
 * Wraps an already-converted component's actions so each is directly
 * callable (e.g. `slack.actions.postMessage({ ... })`), with no `.perform`
 * and no context argument required.
 *
 * Not part of `convertComponent`'s own behavior — `npmComponent()` calls
 * this on the converted component. `component()` keeps producing the exact
 * same plain `Action` shape it always has, for every consumer of the platform
 * bundle (`prism components:publish`, manifest generation, low-code).
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

/**
 * The npm-publishable form of a component, typed from its definition: what
 * `npmComponent(definition)` returns. Each action is a {@link CallableAction};
 * triggers, data sources and connections are reference helpers for an
 * integration's flows and config pages, keyed as the definition keys them (a
 * connection by its own `key`).
 *
 * It is deliberately not a {@link Component}: the platform bundle and the npm
 * package are separate artifacts, and only the former is what the runner loads.
 */
export type NpmComponent<TDefinition extends ComponentDefinition<boolean, string>> = Omit<
  Component,
  "actions" | "triggers" | "dataSources" | "connections"
> & {
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

/** {@link NpmComponent} with its definition erased: what wrapping an
 * already-converted {@link Component} can promise. */
export type AnyNpmComponent = Omit<
  Component,
  "actions" | "triggers" | "dataSources" | "connections"
> & {
  actions: Record<string, AnyCallableAction>;
  triggers: Record<string, CallableTriggerHelper<AnyTrigger>>;
  dataSources: Record<string, CallableDataSourceHelper>;
  connections: Record<string, CallableConnectionHelper>;
};

export const createNpmComponent = (component: Component): AnyNpmComponent => {
  const actions = Object.entries(component.actions).reduce<Record<string, AnyCallableAction>>(
    (result, [key, action]) => {
      result[key] = createCallableAction(action);
      return result;
    },
    {},
  );

  const triggers = Object.entries(component.triggers ?? {}).reduce<
    Record<string, CallableTriggerHelper<AnyTrigger>>
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

  return { ...component, actions, triggers, dataSources, connections };
};
