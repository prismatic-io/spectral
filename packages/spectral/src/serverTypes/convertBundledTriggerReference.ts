import type {
  ComponentReference,
  ComponentRegistry,
  ConfigVarResultCollection,
  Inputs,
  TriggerPerformFunction,
} from "../types";
import type {
  AnyDataSource,
  AnyTrigger,
  DataSource as ServerDataSource,
  Input as ServerTriggerInput,
  TriggerResult,
} from ".";
import { runWithContext } from "./asyncContext";
import { type BundledTriggerReference, isBundledTriggerReference } from "./bundledTrigger";
import { createCNIContext } from "./context";
import { hoistBundledDataSource } from "./convertBundledDataSourceReference";
import { convertReferenceValues } from "./convertIntegration";
import type { Input as ServerInput } from "./integration";

export type ConvertedBundledTriggerReference = BundledTriggerReference<AnyTrigger>;

export const asBundledTriggerReference = (
  ref: unknown,
): ConvertedBundledTriggerReference | undefined =>
  isBundledTriggerReference(ref) ? (ref as ConvertedBundledTriggerReference) : undefined;

export const convertBundledTriggerReferenceInputs = (
  bundledTriggerReference: ConvertedBundledTriggerReference,
): Record<string, ServerInput> => {
  const inputsByKey = Object.fromEntries(
    bundledTriggerReference.trigger.inputs.map((input) => [input.key, input]),
  );
  return convertReferenceValues(
    inputsByKey,
    bundledTriggerReference.values as ComponentReference["values"],
  );
};

/**
 * An npm trigger's own `Input[]` may carry a `dataSource` field naming a *sibling* data source on
 * the same source component (e.g. foo's `channelId` input has `dataSource: "selectChannels"`).
 * That sibling can't resolve once the trigger is hoisted onto the CNI's own wrapper component —
 * there's no external manifest component to resolve it against — so this synthesizes a CNI-owned
 * copy of the sibling data source (keyed uniquely per wrapper trigger, to avoid collisions across
 * flows) and rewrites the input to point at it, mirroring how a config var's own npm data source
 * reference gets hoisted (see `createBundledDataSourcePerform`/`convertedDataSources`).
 */
export const resolveBundledTriggerSiblingDataSources = (
  bundledTriggerReference: ConvertedBundledTriggerReference,
  wrapperTriggerKey: string,
  componentRegistry: ComponentRegistry,
): { inputs: ServerTriggerInput[]; dataSources: Record<string, ServerDataSource> } => {
  const siblingDataSources = bundledTriggerReference.dataSources as Record<string, AnyDataSource>;
  const dataSources: Record<string, ServerDataSource> = {};

  const inputs = bundledTriggerReference.trigger.inputs.map((input) => {
    const siblingKey = input.dataSource;
    const bundledDataSource = siblingKey ? siblingDataSources[siblingKey] : undefined;
    if (!siblingKey || !bundledDataSource) {
      return input;
    }

    const wrapperDataSourceKey = `${wrapperTriggerKey}_${siblingKey}`;
    if (!(wrapperDataSourceKey in dataSources)) {
      hoistBundledDataSource({
        dataSource: bundledDataSource,
        hoistedKey: wrapperDataSourceKey,
        keyPrefix: wrapperTriggerKey,
        siblings: siblingDataSources,
        componentRegistry,
        hoisted: dataSources,
      });
    }

    return { ...input, dataSource: wrapperDataSourceKey };
  });

  return { inputs, dataSources };
};

export const createBundledTriggerPerform = (
  bundledTrigger: AnyTrigger,
  componentRegistry: ComponentRegistry,
): TriggerPerformFunction<Inputs, ConfigVarResultCollection, boolean, TriggerResult> => {
  return async (context, payload, params) => {
    const cniContext = createCNIContext(context, componentRegistry);
    return await runWithContext(cniContext, async () =>
      (
        bundledTrigger.perform as unknown as TriggerPerformFunction<
          Inputs,
          ConfigVarResultCollection,
          boolean,
          TriggerResult
        >
      )(cniContext, payload, params),
    );
  };
};

export const createBundledOnDeployPerform = (
  bundledTrigger: AnyTrigger,
  componentRegistry: ComponentRegistry,
): TriggerPerformFunction<Inputs, ConfigVarResultCollection, boolean, TriggerResult> => {
  return async (context, payload, params) => {
    const cniContext = createCNIContext(context, componentRegistry);
    return await runWithContext(cniContext, async () =>
      (
        bundledTrigger.onDeployPerform as unknown as TriggerPerformFunction<
          Inputs,
          ConfigVarResultCollection,
          boolean,
          TriggerResult
        >
      )(cniContext, payload, params),
    );
  };
};

export type TriggerWireFields = Pick<
  AnyTrigger,
  | "scheduleSupport"
  | "synchronousResponseSupport"
  | "isPollingTrigger"
  | "triggerResolverSupport"
  | "triggerResolverDefaultBatchSize"
  | "triggerResolverDefaultConcurrentBatchLimit"
  | "resolveTriggerItems"
  | "hasResolveTriggerItems"
  | "getNextPaginationState"
  | "hasGetNextDiscoveryState"
  | "hasOnDeployPerform"
  | "resolveOnDeployItems"
  | "hasResolveOnDeployItems"
  | "getOnDeployNextPaginationState"
  | "hasGetOnDeployNextDiscoveryState"
> & {
  // Narrower than AnyTrigger's: the wrapper always runs it as a plain trigger perform.
  onDeployPerform?: TriggerPerformFunction<
    Inputs,
    ConfigVarResultCollection,
    boolean,
    TriggerResult
  >;
};

type CopiedTriggerFields =
  | "terminateExecution"
  | "breakLoop"
  | "allowsBranching"
  | "staticBranchNames"
  | "dynamicBranchInput";

/** Wire fields for a wrapper around an npm trigger. The copied behavior settings are required keys
 * (their values may still be undefined) so a field can't be silently left out of the wrapper.
 * Not `Required<Pick<...>>`, which would also strip `undefined` from the values. */
export type BundledTriggerWireFields = {
  [K in CopiedTriggerFields]-?: AnyTrigger[K];
} & TriggerWireFields;

export const bundledTriggerWireFields = (
  bundledTrigger: AnyTrigger,
  componentRegistry: ComponentRegistry,
): BundledTriggerWireFields => ({
  terminateExecution: bundledTrigger.terminateExecution,
  breakLoop: bundledTrigger.breakLoop,
  allowsBranching: bundledTrigger.allowsBranching,
  staticBranchNames: bundledTrigger.staticBranchNames,
  dynamicBranchInput: bundledTrigger.dynamicBranchInput,
  scheduleSupport: bundledTrigger.scheduleSupport,
  synchronousResponseSupport: bundledTrigger.synchronousResponseSupport,
  isPollingTrigger: Boolean(bundledTrigger.isPollingTrigger),
  triggerResolverSupport: bundledTrigger.triggerResolverSupport ?? "invalid",
  ...(bundledTrigger.triggerResolverDefaultBatchSize !== undefined
    ? { triggerResolverDefaultBatchSize: bundledTrigger.triggerResolverDefaultBatchSize }
    : {}),
  ...(bundledTrigger.triggerResolverDefaultConcurrentBatchLimit !== undefined
    ? {
        triggerResolverDefaultConcurrentBatchLimit:
          bundledTrigger.triggerResolverDefaultConcurrentBatchLimit,
      }
    : {}),
  ...(bundledTrigger.resolveTriggerItems
    ? { resolveTriggerItems: bundledTrigger.resolveTriggerItems, hasResolveTriggerItems: true }
    : {}),
  ...(bundledTrigger.getNextPaginationState
    ? {
        getNextPaginationState: bundledTrigger.getNextPaginationState,
        hasGetNextDiscoveryState: true,
      }
    : {}),
  ...(bundledTrigger.onDeployPerform
    ? {
        onDeployPerform: createBundledOnDeployPerform(bundledTrigger, componentRegistry),
        hasOnDeployPerform: true,
      }
    : {}),
  ...(bundledTrigger.resolveOnDeployItems
    ? { resolveOnDeployItems: bundledTrigger.resolveOnDeployItems, hasResolveOnDeployItems: true }
    : {}),
  ...(bundledTrigger.getOnDeployNextPaginationState
    ? {
        getOnDeployNextPaginationState: bundledTrigger.getOnDeployNextPaginationState,
        hasGetOnDeployNextDiscoveryState: true,
      }
    : {}),
});
