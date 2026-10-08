import type {
  ActionDefinition,
  ActionInputParameters,
  CallableActionInputParameters,
} from "../types";
import type { CollectionType } from "../types/ConfigVars";
import type { Action, ActionContext, AnyConvertedAction, Component, Input } from ".";
import { performActionFunctionExecutor } from "./actionExecutor";
import { requireContext } from "./asyncContext";
import { convertInputValue } from "./convertIntegration";

/** A converted {@link Action}, directly callable with just its input values
 * (e.g. `slack.actions.postMessage({ ... })`). Resolves the acting context
 * ambiently via {@link requireContext}, so it only works while running
 * inside a flow step (which establishes that context via `runWithContext`).
 * All of the `Action` data properties (`key`, `inputs`, `perform`, ...) are
 * still present on it, for the runner and other existing consumers that
 * invoke `.perform(context, params)` directly. */
export type CallableAction = Action & ((values: Record<string, unknown>) => Promise<unknown>);

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

export const createCallableAction = (action: Action): CallableAction => {
  const callable = async (values: Record<string, unknown> = {}) => {
    const context = requireContext();
    const filledValues = fillDefaults(action.inputs, values);
    return performActionFunctionExecutor(action.perform, context, filledValues);
  };

  return Object.assign(callable, action);
};

/** Maps a single already-converted action to its directly-callable form,
 * inferring the callable signature structurally off its own `perform` (the
 * `context` parameter is dropped; the rest is unchanged) — this doesn't need
 * the original `ActionDefinition`, since `createCallableComponent` only ever
 * has an already-converted `Component` to work from. */
export type MakeCallable<TAction> = TAction extends {
  perform: (context: never, params: infer TParams) => infer TReturn;
}
  ? TAction & ((params: TParams) => TReturn)
  : TAction;

/** The directly-callable form of an action, typed from its original
 * `ActionDefinition` rather than from the converted `perform`: that keeps the
 * input definitions in reach, so inputs that aren't `required: true` (or that
 * have a `default`) are optional to the caller — see
 * {@link CallableActionInputParameters} — while the return type stays the
 * `perform`'s own. This is what `component(definition, { callable: true })`
 * produces; {@link MakeCallable} is the fallback for wrapping a component whose
 * definitions are no longer available. */
export type CallableConvertedAction<TDef> =
  TDef extends ActionDefinition<
    infer TInputs,
    infer TConfigVars,
    infer _TAllowsBranching,
    infer TReturn
  >
    ? Omit<Action, "perform"> & {
        perform: (
          context: ActionContext<TConfigVars>,
          params: ActionInputParameters<TInputs>,
        ) => Promise<TReturn>;
      } & ((params: CallableActionInputParameters<TInputs>) => Promise<TReturn>)
    : never;

/**
 * Wraps an already-converted component's actions so each is directly
 * callable (e.g. `slack.actions.postMessage({ ... })`), with no `.perform`
 * and no context argument required.
 *
 * Not part of `convertComponent`'s own unconditional behavior — `component()`
 * calls this internally, only when its caller opts in via
 * `component(definition, { callable: true })`. Without that option,
 * `component()` keeps producing the exact same plain `Action`/`ConvertedAction`
 * shape it always has, for every consumer that doesn't ask for the callable
 * form (the legacy self-contained bundle `prism components:publish` uses,
 * manifest generation, low-code).
 */
export const createCallableComponent = <
  TComponent extends Component<any, any, any, any, any, any, Record<string, AnyConvertedAction>>,
>(
  component: TComponent,
): Omit<TComponent, "actions"> & {
  actions: { [K in keyof TComponent["actions"]]: MakeCallable<TComponent["actions"][K]> };
} => {
  const actions = Object.entries(component.actions).reduce<Record<string, CallableAction>>(
    (result, [key, action]) => {
      result[key] = createCallableAction(action as Action);
      return result;
    },
    {},
  );

  return { ...component, actions } as unknown as Omit<TComponent, "actions"> & {
    actions: { [K in keyof TComponent["actions"]]: MakeCallable<TComponent["actions"][K]> };
  };
};
