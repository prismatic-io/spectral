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
import { isNpmTriggerReference, type NpmTriggerReference } from "./callableTrigger";
import { createCNIContext } from "./context";
import { convertReferenceValues } from "./convertIntegration";
import { hoistNpmDataSource } from "./convertNpmDataSourceReference";
import type { Input as ServerInput } from "./integration";

export type ConvertedNpmTriggerReference = NpmTriggerReference<AnyTrigger>;

export const asNpmTriggerReference = (ref: unknown): ConvertedNpmTriggerReference | undefined =>
  isNpmTriggerReference(ref) ? (ref as ConvertedNpmTriggerReference) : undefined;

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

/**
 * An npm trigger's own `Input[]` may carry a `dataSource` field naming a *sibling* data source on
 * the same source component (e.g. foo's `channelId` input has `dataSource: "selectChannels"`).
 * That sibling can't resolve once the trigger is hoisted onto the CNI's own wrapper component —
 * there's no external manifest component to resolve it against — so this synthesizes a CNI-owned
 * copy of the sibling data source (keyed uniquely per wrapper trigger, to avoid collisions across
 * flows) and rewrites the input to point at it, mirroring how a config var's own npm data source
 * reference gets hoisted (see `createNpmDataSourcePerform`/`convertedDataSources`).
 */
export const resolveNpmTriggerSiblingDataSources = (
  npmTriggerReference: ConvertedNpmTriggerReference,
  wrapperTriggerKey: string,
  componentRegistry: ComponentRegistry,
): { inputs: ServerTriggerInput[]; dataSources: Record<string, ServerDataSource> } => {
  const siblingDataSources = npmTriggerReference.dataSources as Record<string, AnyDataSource>;
  const dataSources: Record<string, ServerDataSource> = {};

  const inputs = npmTriggerReference.trigger.inputs.map((input) => {
    const siblingKey = input.dataSource;
    const npmDataSource = siblingKey ? siblingDataSources[siblingKey] : undefined;
    if (!siblingKey || !npmDataSource) {
      return input;
    }

    const wrapperDataSourceKey = `${wrapperTriggerKey}_${siblingKey}`;
    if (!(wrapperDataSourceKey in dataSources)) {
      hoistNpmDataSource({
        dataSource: npmDataSource,
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
export type NpmTriggerWireFields = {
  [K in CopiedTriggerFields]-?: AnyTrigger[K];
} & TriggerWireFields;

export const npmTriggerWireFields = (
  npmTrigger: AnyTrigger,
  componentRegistry: ComponentRegistry,
): NpmTriggerWireFields => ({
  terminateExecution: npmTrigger.terminateExecution,
  breakLoop: npmTrigger.breakLoop,
  allowsBranching: npmTrigger.allowsBranching,
  staticBranchNames: npmTrigger.staticBranchNames,
  dynamicBranchInput: npmTrigger.dynamicBranchInput,
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
