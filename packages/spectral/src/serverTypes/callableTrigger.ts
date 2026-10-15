import type { NpmTriggerReference } from "../types";
import type { AnyDataSource, AnyTrigger } from ".";

export type { NpmTriggerReference } from "../types";
export { isNpmTriggerReference } from "../types";

/**
 * Wraps an already-converted trigger as a callable reference helper (e.g.
 * `slack.triggers.webhook({ ... })`), mirroring the manifest-era generated helper of the same
 * name but sourced directly from the npm-imported component — no component registry involved.
 *
 * Not part of `convertComponent`'s own unconditional behavior — `component()` calls this
 * internally by the consumer facade produced by `callableComponent(definition)`.
 *
 * `dataSources` can be resolved once this trigger is hoisted onto the CNI's own
 * wrapper component. See `NpmTriggerReference`.
 */
export const createCallableTrigger =
  <TTrigger extends AnyTrigger>(trigger: TTrigger, dataSources: Record<string, AnyDataSource>) =>
  (values: Record<string, unknown> = {}): NpmTriggerReference<TTrigger> => ({
    __npmTriggerReference: true,
    trigger,
    values,
    dataSources,
  });
