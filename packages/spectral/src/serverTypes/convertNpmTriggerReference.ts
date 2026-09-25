import type {
  ComponentReference,
  ComponentRegistry,
  ConfigVarResultCollection,
  Inputs,
  TriggerOptionChoice,
  TriggerPerformFunction,
} from "../types";
import type { AnyTrigger, TriggerResult } from ".";
import { runWithContext } from "./asyncContext";
import { isNpmTriggerReference, type NpmTriggerReference } from "./callableTrigger";
import { createCNIContext } from "./context";
import { convertReferenceValues } from "./convertIntegration";
import type { Input as ServerInput } from "./integration";

/** `NpmTriggerReference` concretized to the real server `Trigger` type used throughout this
 * module's conversion logic (the author-facing type in `types/` leaves `trigger` as `unknown` to
 * avoid a `types` → `serverTypes` import cycle). */
export type ConvertedNpmTriggerReference = NpmTriggerReference<AnyTrigger>;

export const asNpmTriggerReference = (ref: unknown): ConvertedNpmTriggerReference | undefined =>
  isNpmTriggerReference(ref) ? (ref as ConvertedNpmTriggerReference) : undefined;

/** The npm-reference counterpart of `convertComponentReference`'s `inputs` — keyed directly off
 * the referenced trigger's own already-converted `Input[]`, no component registry involved. */
export const convertNpmTriggerReferenceInputs = (
  npmTriggerReference: ConvertedNpmTriggerReference,
): Record<string, ServerInput> => {
  const inputsByKey = Object.fromEntries(
    npmTriggerReference.trigger.inputs.map((input) => [input.key, input]),
  );
  return convertReferenceValues(
    inputsByKey,
    npmTriggerReference.values as ComponentReference["values"],
  );
};

export const createNpmTriggerPerform = (
  npmTrigger: AnyTrigger,
  componentRegistry: ComponentRegistry,
): TriggerPerformFunction<Inputs, ConfigVarResultCollection, boolean, TriggerResult> => {
  return async (context, payload, params) => {
    const cniContext = createCNIContext(context, componentRegistry);
    return await runWithContext(cniContext, async () =>
      (
        npmTrigger.perform as unknown as TriggerPerformFunction<
          Inputs,
          ConfigVarResultCollection,
          boolean,
          TriggerResult
        >
      )(cniContext, payload, params),
    );
  };
};

export const createNpmOnDeployPerform = (
  npmTrigger: AnyTrigger,
  componentRegistry: ComponentRegistry,
): TriggerPerformFunction<Inputs, ConfigVarResultCollection, boolean, TriggerResult> => {
  return async (context, payload, params) => {
    const cniContext = createCNIContext(context, componentRegistry);
    return await runWithContext(cniContext, async () =>
      (
        npmTrigger.onDeployPerform as unknown as TriggerPerformFunction<
          Inputs,
          ConfigVarResultCollection,
          boolean,
          TriggerResult
        >
      )(cniContext, payload, params),
    );
  };
};

/**
 * The subset of a synthesized wrapper trigger's fields both `npmTriggerWireFields` and
 * `convertIntegration.ts`'s `authoredTriggerWireFields` produce. Declared explicitly (rather
 * than reused from `AnyTrigger`) so each field keeps its narrow literal type (e.g.
 * `TriggerOptionChoice`, not `string`) once pulled out of the surrounding object literal's
 * contextual typing — and so it never pulls in `perform`, whose type is parameterized over the
 * enclosing function's own `TInputs`/`TActionInputs`, not `AnyTrigger`'s erased ones.
 */
export interface TriggerWireFields {
  scheduleSupport: TriggerOptionChoice;
  synchronousResponseSupport: TriggerOptionChoice;
  isPollingTrigger: boolean;
  triggerResolverSupport: TriggerOptionChoice;
  triggerResolverDefaultBatchSize?: number;
  triggerResolverDefaultConcurrentBatchLimit?: number;
  resolveTriggerItems?: AnyTrigger["resolveTriggerItems"];
  hasResolveTriggerItems?: boolean;
  getNextPaginationState?: AnyTrigger["getNextPaginationState"];
  hasGetNextDiscoveryState?: boolean;
  onDeployPerform?: TriggerPerformFunction<
    Inputs,
    ConfigVarResultCollection,
    boolean,
    TriggerResult
  >;
  hasOnDeployPerform?: boolean;
  resolveOnDeployItems?: AnyTrigger["resolveOnDeployItems"];
  hasResolveOnDeployItems?: boolean;
  getOnDeployNextPaginationState?: AnyTrigger["getOnDeployNextPaginationState"];
  hasGetOnDeployNextDiscoveryState?: boolean;
}

/** The synthesized wrapper trigger's schedule/polling/resolver/on-deploy wire fields when the
 * flow references an already-built npm trigger — all sourced from that trigger's own
 * conversion (`trigger`/`batchTrigger`/`pollingTrigger`, see `convertTrigger`). */
export const npmTriggerWireFields = (
  npmTrigger: AnyTrigger,
  componentRegistry: ComponentRegistry,
): TriggerWireFields => ({
  scheduleSupport: npmTrigger.scheduleSupport,
  synchronousResponseSupport: npmTrigger.synchronousResponseSupport,
  isPollingTrigger: Boolean(npmTrigger.isPollingTrigger),
  triggerResolverSupport: npmTrigger.triggerResolverSupport ?? "invalid",
  ...(npmTrigger.triggerResolverDefaultBatchSize !== undefined
    ? { triggerResolverDefaultBatchSize: npmTrigger.triggerResolverDefaultBatchSize }
    : {}),
  ...(npmTrigger.triggerResolverDefaultConcurrentBatchLimit !== undefined
    ? {
        triggerResolverDefaultConcurrentBatchLimit:
          npmTrigger.triggerResolverDefaultConcurrentBatchLimit,
      }
    : {}),
  ...(npmTrigger.resolveTriggerItems
    ? { resolveTriggerItems: npmTrigger.resolveTriggerItems, hasResolveTriggerItems: true }
    : {}),
  ...(npmTrigger.getNextPaginationState
    ? {
        getNextPaginationState: npmTrigger.getNextPaginationState,
        hasGetNextDiscoveryState: true,
      }
    : {}),
  ...(npmTrigger.onDeployPerform
    ? {
        onDeployPerform: createNpmOnDeployPerform(npmTrigger, componentRegistry),
        hasOnDeployPerform: true,
      }
    : {}),
  ...(npmTrigger.resolveOnDeployItems
    ? { resolveOnDeployItems: npmTrigger.resolveOnDeployItems, hasResolveOnDeployItems: true }
    : {}),
  ...(npmTrigger.getOnDeployNextPaginationState
    ? {
        getOnDeployNextPaginationState: npmTrigger.getOnDeployNextPaginationState,
        hasGetOnDeployNextDiscoveryState: true,
      }
    : {}),
});
