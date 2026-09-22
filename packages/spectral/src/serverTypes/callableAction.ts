import type { CollectionType } from "../types/ConfigVars";
import type { Action, AnyConvertedAction, Component, Input } from ".";
import { executeAction } from "./actionExecutor";
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

const fillDefaults = (inputs: Input[], values: Record<string, unknown>) =>
  inputs.reduce<Record<string, unknown>>((accumulator, input) => {
    const value = values[input.key] ?? input.default;
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
    return executeAction(action.perform, context, filledValues);
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
