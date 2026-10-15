import type {
  ActionDefinition,
  CallableActionInputParameters,
  ComponentReference,
  NpmConnectionReferenceConfigVar,
  NpmDataSourceReferenceConfigVar,
} from "../types";
import type { CollectionType } from "../types/ConfigVars";
import type { Action, AnyConnection, AnyDataSource, AnyTrigger, Component, Input } from ".";
import { performActionFunctionExecutor } from "./actionExecutor";
import { requireContext } from "./asyncContext";
import { type CallableConnectionConfigVar, createCallableConnection } from "./callableConnection";
import { type CallableDataSourceConfigVar, createCallableDataSource } from "./callableDataSource";
import { createCallableTrigger, type NpmTriggerReference } from "./callableTrigger";
import { convertInputValue } from "./convertIntegration";

/** An action facade, directly callable with just its input values
 * (e.g. `slack.actions.postMessage({ ... })`). Resolves the acting context
 * ambiently via {@link requireContext}, so it only works while running
 * inside a flow step (which establishes that context via `runWithContext`).
 * This is deliberately not also an {@link Action}: npm consumers get a small
 * callable facade, while the platform bundle retains the normal server shape. */
export type CallableAction = (values?: Record<string, unknown>) => Promise<unknown>;

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
      ? {
          ...value,
          values: fillDefaults(selected.inputs, isPlainObject(values) ? values : {}),
        }
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

export const createCallableAction = (action: Action): CallableAction => {
  const callable = async (values: Record<string, unknown> = {}) => {
    const context = requireContext();
    const filledValues = fillDefaults(action.inputs, values);
    return performActionFunctionExecutor(action.perform, context, filledValues);
  };

  return callable;
};

/** The directly-callable form of an action, typed from the original
 * `ActionDefinition` rather than from the converted `perform`. Only the
 * definition still carries each input's `required` and `default`; the converted
 * `perform` has already flattened them into plain value types. Reading them from
 * the definition is what lets inputs that aren't `required: true` (or that have
 * a `default`) be optional to the caller — see
 * {@link CallableActionInputParameters} — while the return type stays the
 * `perform`'s own. This is what `callableComponent(definition)` produces;
 * definitions are still available to the public builder. */
export type CallableConvertedAction<TDef> =
  TDef extends ActionDefinition<
    infer TInputs,
    infer _TConfigVars,
    infer _TAllowsBranching,
    infer TReturn
  >
    ? (params: CallableActionInputParameters<TInputs>) => Promise<TReturn>
    : never;

/**
 * Wraps an already-converted component's actions so each is directly
 * callable (e.g. `slack.actions.postMessage({ ... })`), with no `.perform`
 * and no context argument required.
 *
 * Not part of `convertComponent`'s own unconditional behavior. The public
 * `callableComponent()` builder calls this for the npm artifact; `component()`
 * continues to produce the platform's erased `Action` shape.
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

export const createCallableComponent = <TComponent extends Component>(
  component: TComponent,
): Omit<TComponent, "actions" | "triggers" | "dataSources" | "connections"> & {
  actions: Record<string, CallableAction>;
  triggers: {
    [K in keyof TComponent["triggers"]]: CallableTriggerHelper<TComponent["triggers"][K]>;
  };
  dataSources: {
    [K in keyof TComponent["dataSources"]]: CallableDataSourceHelper;
  };
  // `connections` is an array on `Component` (each self-keyed by its own `.key`, e.g. "oauth2")
  connections: Record<string, CallableConnectionHelper>;
} => {
  const actions = Object.entries(component.actions).reduce<Record<string, CallableAction>>(
    (result, [key, action]) => {
      result[key] = createCallableAction(action as Action);
      return result;
    },
    {},
  );

  const triggers = Object.entries(component.triggers ?? {}).reduce<
    Record<string, CallableTriggerHelper<unknown>>
  >((result, [key, trigger]) => {
    result[key] = createCallableTrigger(trigger as AnyTrigger, component.dataSources ?? {});
    return result;
  }, {});

  const dataSources = Object.entries(component.dataSources ?? {}).reduce<
    Record<string, CallableDataSourceHelper>
  >((result, [key, dataSource]) => {
    result[key] = createCallableDataSource(
      dataSource as AnyDataSource,
      component.dataSources ?? {},
    );
    return result;
  }, {});

  const connections = (component.connections ?? []).reduce<
    Record<string, CallableConnectionHelper>
  >((result, connection) => {
    result[(connection as AnyConnection).key] = createCallableConnection(
      connection as AnyConnection,
    );
    return result;
  }, {});

  return {
    ...component,
    actions,
    triggers,
    dataSources,
    connections,
  } as unknown as Omit<TComponent, "actions" | "triggers" | "dataSources" | "connections"> & {
    actions: Record<string, CallableAction>;
    triggers: {
      [K in keyof TComponent["triggers"]]: CallableTriggerHelper<TComponent["triggers"][K]>;
    };
    dataSources: {
      [K in keyof TComponent["dataSources"]]: CallableDataSourceHelper;
    };
    connections: Record<string, CallableConnectionHelper>;
  };
};
