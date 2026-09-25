import type { NpmTriggerReference } from "../types";
import type { AnyTrigger } from ".";

export type { NpmTriggerReference } from "../types";
export { isNpmTriggerReference } from "../types";

/**
 * Wraps an already-converted trigger as a callable reference helper (e.g.
 * `slack.triggers.webhook({ ... })`), mirroring the manifest-era generated helper of the same
 * name but sourced directly from the npm-imported component — no component registry involved.
 *
 * Not part of `convertComponent`'s own unconditional behavior — `component()` calls this
 * internally (via `createCallableComponent`), only when its caller opts in via
 * `component(definition, { callable: true })`.
 */
export const createCallableTrigger =
  <TTrigger extends AnyTrigger>(trigger: TTrigger) =>
  (values: Record<string, unknown> = {}): NpmTriggerReference<TTrigger> => ({
    __npmTriggerReference: true,
    trigger,
    values,
  });
