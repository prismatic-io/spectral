import { randomUUID } from "node:crypto";
import { readFileSync } from "fs";
import assign from "lodash/assign";
import camelCase from "lodash/camelCase";
import merge from "lodash/merge";
import pick from "lodash/pick";
import path from "path";
import YAML from "yaml";
import {
  type BatchTrigger,
  type CollectionType,
  type ComponentManifest,
  type ComponentReference,
  type ComponentRegistry,
  type ConfigPages,
  type ConfigVar,
  type ConfigVarResultCollection,
  type ConnectionTemplateInputField,
  DEFAULT_JSON_SCHEMA_VERSION,
  type EndpointType,
  type Flow,
  type FlowDefinitionFlowSchema,
  type FlowSchema,
  type FlowTriggerType,
  type Inputs,
  type IntegrationDefinition,
  isComponentReference,
  isConnectionDefinitionConfigVar,
  isConnectionReferenceConfigVar,
  isConnectionScopedConfigVar,
  isDataSourceDefinitionConfigVar,
  isDataSourceReferenceConfigVar,
  isHtmlElementConfigVar,
  isJsonFormConfigVar,
  isJsonFormDataSourceConfigVar,
  isScheduleConfigVar,
  type KeyValuePair,
  type OnPremiseConnectionConfigTypeEnum,
  type PermissionAndVisibilityType,
  type PollingTriggerPerformFunction,
  type PollingTriggerType,
  type QueueConfig,
  type StandardQueueConfig,
  type StandardTriggerType,
  type TriggerEventFunctionReturn,
  type TriggerPerformFunction,
  type TriggerResult as TriggerPerformResult,
  type TriggerReference,
} from "../types";
import type {
  ActionContext,
  ActionPerformFunction,
  PublishingMetadata,
  Action as ServerAction,
  ActionPerformFunction as ServerActionPerformFunction,
  Component as ServerComponent,
  Connection as ServerConnection,
  DataSource as ServerDataSource,
  Trigger as ServerTrigger,
  Input as ServerTriggerInput,
  TriggerEventFunction,
  TriggerPayload,
  TriggerResult,
} from ".";
import { runWithContext } from "./asyncContext";
import { createCNIContext, logDebugResults } from "./context";
import {
  convertInput,
  convertTemplateInput,
  validateBatchSize,
  validateConcurrentBatchLimit,
} from "./convertComponent";
import {
  DefinitionVersion,
  type ComponentReference as ServerComponentReference,
  type ConfigPage as ServerConfigPage,
  type DefaultRequiredConfigVariable as ServerDefaultRequiredConfigVariable,
  type Input as ServerInput,
  type RequiredConfigVariable as ServerRequiredConfigVariable,
} from "./integration";
import { createCNIComponentRefPerform, createCNIPerform, createCNIPollingPerform } from "./perform";
import type { CNIPollingPerformFunction, ComponentRefTriggerPerformFunction } from "./triggerTypes";

export const CONCURRENCY_LIMIT_MAX = 15;
export const CONCURRENCY_LIMIT_MIN = 2;

/**
 * The wire-shape resolver synthesized by {@link normalizeBatchedFlow} and read by the trigger
 * reducer. Mirrors the server `Trigger`'s `resolveTriggerItems`/`getNextPaginationState` slots.
 */
interface WireResolver {
  resolveItems?: (context: ActionContext, result: { payload: TriggerPayload }) => unknown[];
  getNextPaginationState?: (
    context: ActionContext,
    result: { payload: TriggerPayload },
  ) => Record<string, unknown> | null;
}

/**
 * Default `resolveItems`: a batched `trigger`'s fires return their records under
 * `payload.body.data` (the wrapper {@link normalizeBatchedFlow} builds writes them there),
 * so extraction is just reading that array back. Authors never write this themselves.
 */
const defaultResolveItems = (
  _context: ActionContext,
  result: { payload: { body: { data: unknown } } },
) => result.payload.body.data as unknown[];

/**
 * Default `getNextPaginationState`: a batched fire returns the next page's cursor as
 * `paginationState`, which the wrapper {@link normalizeBatchedFlow} builds stamps onto
 * `payload.paginationState`. Reading it back (defaulting to `null`) is the whole loop: a
 * non-null value re-invokes the fire, `null` ends it. Authors never write this.
 */
const defaultGetNextPaginationState = (
  _context: ActionContext,
  result: { payload: { paginationState?: Record<string, unknown> | null } },
) => result.payload.paginationState ?? null;

/**
 * Expands a flow's batched `trigger` (built with `batchFlowTrigger`) into the flat
 * `onTrigger`/`onDeployTrigger`/`triggerResolver`/`onDeployResolver` shape the rest of the
 * conversion pipeline already understands. The trigger fires return `{ items, paginationState? }`;
 * here we wrap each into a `TriggerPerformFunction` that emits `{ payload: { …payload, body: {
 * data: items }, paginationState } }`, then synthesize the default `resolveItems` (reads the
 * items back) and `getNextPaginationState` (reads the cursor back). Flows without a `trigger`
 * pass through unchanged.
 *
 * Returns the same `Flow` type it received; the synthesized `triggerResolver`/`onDeployResolver`
 * are wire-only fields (not on the author-facing `Flow`), read downstream via `"x" in flow` checks.
 */
const normalizeBatchedFlow = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload,
  TAllowsBranching extends boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload>,
>(
  flow: Flow<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>,
): Flow<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult> => {
  const trigger =
    "trigger" in flow ? (flow.trigger as BatchTrigger<unknown> | undefined) : undefined;
  if (!trigger) {
    return flow;
  }

  const { onTrigger, onDeploy } = trigger;

  // Wrap a batched fire (returns `{ items, paginationState?, response? }`) into a
  // TriggerPerformFunction that emits the wire payload shape: items at `body.data` and the
  // next-page cursor at `paginationState` (defaulting `null` to terminate the loop). The
  // incoming payload's `paginationState` was already consumed by the fire, so overwriting it
  // with the returned cursor is safe — `getNextPaginationState` reads it straight back.
  const wrapFire =
    (fire: NonNullable<BatchTrigger<unknown>["onTrigger"]>) =>
    async (context: ActionContext, payload: TriggerPayload) => {
      const { items, paginationState, response } = await fire(context as never, payload as never);
      return {
        payload: {
          ...payload,
          body: { data: items, contentType: "application/json" },
          paginationState: paginationState ?? null,
        },
        ...(response ? { response } : {}),
      };
    };

  const { trigger: _omitTrigger, ...rest } = flow as unknown as Record<string, unknown>;

  return {
    ...rest,
    onTrigger: wrapFire(onTrigger),
    ...(onDeploy ? { onDeployTrigger: wrapFire(onDeploy) } : {}),
    triggerResolver: {
      resolveItems: defaultResolveItems,
      getNextPaginationState: defaultGetNextPaginationState,
    },
    ...(onDeploy
      ? {
          onDeployResolver: {
            resolveItems: defaultResolveItems,
            getNextPaginationState: defaultGetNextPaginationState,
          },
        }
      : {}),
  } as unknown as Flow<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>;
};

export const convertIntegration = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
>(
  definition: IntegrationDefinition<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>,
): ServerComponent<
  TInputs,
  TActionInputs,
  ConfigVarResultCollection,
  TPayload,
  TAllowsBranching,
  TResult
> => {
  // Generate a unique reference key that will be used to reference the
  // actions, triggers, data sources, and connections that are created
  // inline as part of the integration definition.
  const referenceKey = randomUUID();

  const scopedConfigVars = definition.scopedConfigVars ?? {};
  const configVars: Record<string, ConfigVar> = Object.values({
    configPages: definition.configPages ?? {},
    userLevelConfigPages: definition.userLevelConfigPages ?? {},
  }).reduce<Record<string, ConfigVar>>(
    (acc, configPages) => ({
      ...acc,
      ...Object.values(configPages).reduce<Record<string, ConfigVar>>(
        (acc, configPage) =>
          Object.entries(configPage.elements).reduce<Record<string, ConfigVar>>(
            (acc, [key, element]) => {
              // "string" elements are HTML elements and should be ignored.
              if (typeof element === "string") {
                return acc;
              }

              if (key in acc || key in scopedConfigVars) {
                throw new Error(`Duplicate config var key: "${key}"`);
              }

              return {
                ...acc,
                [key]: element,
              };
            },
            acc,
          ),
        {},
      ),
    }),
    {},
  );

  let metadata: Record<string, unknown> = {};

  try {
    const metaDataPath = path.join("..", ".spectral", "metadata.json");
    const file = readFileSync(metaDataPath, { encoding: "utf-8" });
    metadata = JSON.parse(file);
  } catch (_e) {
    // No-op. If there's no metadata file then we move on.
  }

  const cniComponent = codeNativeIntegrationComponent(definition, referenceKey, configVars);
  const cniYaml = codeNativeIntegrationYaml(definition, referenceKey, configVars, metadata);
  const publishingMetadata = codeNativeIntegrationPublishingMetadata(definition);

  return {
    ...cniComponent,
    codeNativeIntegrationYAML: cniYaml,
    publishingMetadata,
  };
};

export const convertConfigPages = (
  pages: ConfigPages | undefined,
  userLevelConfigured: boolean,
): ServerConfigPage[] => {
  if (!pages || !Object.keys(pages).length) {
    return [];
  }

  return Object.entries(pages).map<ServerConfigPage>(([name, { tagline, elements }]) => ({
    name,
    tagline,
    ...(userLevelConfigured ? { userLevelConfigured } : {}),
    elements: Object.entries(elements)
      .filter(([_key, value]) => !isConnectionScopedConfigVar(value))
      .map(([key, value]) => {
        if (typeof value === "string") {
          return {
            type: "htmlElement",
            value,
          };
        } else if (
          value &&
          typeof value === "object" &&
          "dataType" in value &&
          value.dataType === "htmlElement"
        ) {
          return {
            type: "htmlElement",
            value: key,
          };
        }

        return {
          type: "configVar",
          value: key,
        };
      }),
  }));
};

const codeNativeIntegrationYaml = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
>(
  {
    name,
    description,
    category,
    documentation,
    version,
    labels,
    endpointType,
    triggerPreprocessFlowConfig,
    flows: rawFlows,
    configPages,
    userLevelConfigPages,
    scopedConfigVars,
    instanceProfile,
    componentRegistry = {},
  }: IntegrationDefinition<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>,
  referenceKey: string,
  configVars: Record<string, ConfigVar>,
  metadata?: Record<string, unknown>,
): string => {
  // Expand any batched `trigger` (built with `batchFlowTrigger`) into the flat
  // onTrigger/onDeployTrigger/triggerResolver/onDeployResolver shape the rest of this
  // pipeline (convertFlow + the trigger reducer) already handles.
  const flows = rawFlows.map((flow) => normalizeBatchedFlow(flow));

  // Find the preprocess flow config on the flow, if one exists.
  const preprocessFlows = flows.filter((flow) => flow.preprocessFlowConfig);

  // Do some validation of preprocess flow configs.
  if (preprocessFlows.length > 1) {
    throw new Error("Only one flow may define a Preprocess Flow Config.");
  }

  if (preprocessFlows.length && triggerPreprocessFlowConfig) {
    throw new Error(
      "Integration must not define both a Trigger Preprocess Flow Config and a Preprocess Flow.",
    );
  }

  const hasPreprocessFlow = preprocessFlows.length > 0;
  const preprocessFlowConfig = hasPreprocessFlow
    ? preprocessFlows[0].preprocessFlowConfig
    : triggerPreprocessFlowConfig;
  const nonPreprocessFlowTypes: EndpointType[] = ["instance_specific", "shared_instance"];
  if (nonPreprocessFlowTypes.includes(endpointType || "flow_specific") && !preprocessFlowConfig) {
    throw new Error(
      "Integration with specified EndpointType must define either a Trigger Preprocess Flow Config or a Preprocess Flow.",
    );
  }

  const configVarMap = Object.entries(scopedConfigVars ?? {}).reduce(
    (acc, [key, value]) => {
      if (typeof value === "string") {
        return acc;
      }

      return {
        ...acc,
        [key]: value,
      };
    },
    { ...(configVars ?? {}) },
  );

  const requiredConfigVars: Array<ServerRequiredConfigVariable> = [];

  Object.entries(configVarMap).forEach(([key, configVar]) => {
    if (!isHtmlElementConfigVar(configVar)) {
      requiredConfigVars.push(convertConfigVar(key, configVar, referenceKey, componentRegistry));
    }
  });

  // Transform the IntegrationDefinition into the structure that is appropriate
  // for generating YAML, which will then be used by the Prismatic API to import
  // the integration as a Code Native Integration.
  const result = {
    definitionVersion: DefinitionVersion,
    isCodeNative: true,
    name,
    description,
    category,
    documentation,
    version,
    labels,
    requiredConfigVars,
    endpointType,
    preprocessFlowName: hasPreprocessFlow ? preprocessFlows[0].name : undefined,
    externalCustomerIdField: fieldNameToReferenceInput(
      hasPreprocessFlow ? "onExecution" : "payload",
      preprocessFlowConfig?.externalCustomerIdField,
    ),
    externalCustomerUserIdField: fieldNameToReferenceInput(
      hasPreprocessFlow ? "onExecution" : "payload",
      preprocessFlowConfig?.externalCustomerUserIdField,
    ),
    flowNameField: fieldNameToReferenceInput(
      hasPreprocessFlow ? "onExecution" : "payload",
      preprocessFlowConfig?.flowNameField,
    ),
    flows: flows.map((flow) => convertFlow(flow, componentRegistry, referenceKey)),
    ...(instanceProfile && { defaultInstanceProfile: instanceProfile }),
    configPages: [
      ...convertConfigPages(configPages, false),
      ...convertConfigPages(userLevelConfigPages, true),
    ],
    importMetadata: metadata,
  };

  return YAML.stringify(result);
};

interface VisibilityAndPermissionValue {
  visibleToOrgDeployer: boolean;
  visibleToCustomerDeployer: boolean;
  orgOnly: boolean;
}

const permissionAndVisibilityTypeValueMap: Record<
  PermissionAndVisibilityType,
  VisibilityAndPermissionValue
> = {
  customer: {
    orgOnly: false,
    visibleToOrgDeployer: true,
    visibleToCustomerDeployer: true,
  },
  embedded: {
    orgOnly: false,
    visibleToOrgDeployer: true,
    visibleToCustomerDeployer: false,
  },
  organization: {
    orgOnly: true,
    visibleToOrgDeployer: true,
    visibleToCustomerDeployer: false,
  },
};

const getPermissionAndVisibilityValues = ({
  permissionAndVisibilityType = "customer",
  visibleToOrgDeployer = true,
}: {
  permissionAndVisibilityType?: PermissionAndVisibilityType;
  visibleToOrgDeployer?: boolean;
}) => {
  return {
    ...permissionAndVisibilityTypeValueMap[permissionAndVisibilityType],
    ...(visibleToOrgDeployer !== undefined ? { visibleToOrgDeployer } : {}),
  };
};

/** Converts permission and visibility properties into `meta` properties for inputs. */
const convertInputPermissionAndVisibility = ({
  permissionAndVisibilityType,
  visibleToOrgDeployer,
}: {
  permissionAndVisibilityType?: PermissionAndVisibilityType;
  visibleToOrgDeployer?: boolean;
}) => {
  const meta = getPermissionAndVisibilityValues({
    permissionAndVisibilityType,
    visibleToOrgDeployer,
  });

  return meta;
};

/** Converts permission and visibility properties into `meta` properties for config vars. */
const convertConfigVarPermissionAndVisibility = ({
  permissionAndVisibilityType,
  visibleToOrgDeployer: visibleToOrgDeployerBase,
}: {
  permissionAndVisibilityType?: PermissionAndVisibilityType;
  visibleToOrgDeployer?: boolean;
}) => {
  const { orgOnly, visibleToCustomerDeployer, visibleToOrgDeployer } =
    getPermissionAndVisibilityValues({
      permissionAndVisibilityType,
      visibleToOrgDeployer: visibleToOrgDeployerBase,
    });

  return {
    orgOnly,
    meta: {
      visibleToCustomerDeployer,
      visibleToOrgDeployer,
    },
  };
};

const convertComponentReference = (
  componentReference: ComponentReference,
  componentRegistry: ComponentRegistry,
  referenceType: Extract<
    keyof ComponentManifest,
    "actions" | "triggers" | "dataSources" | "connections"
  >,
): {
  ref: ServerComponentReference;
  inputs: Record<string, ServerInput>;
} => {
  const manifest = componentRegistry[componentReference.component];

  if (!manifest) {
    throw new Error(
      `Component with key "${componentReference.component}" not found in component registry.`,
    );
  }

  const manifestEntry = manifest[referenceType][componentReference.key];

  if (!manifestEntry) {
    throw new Error(
      `Component with key "${componentReference.component}" does not have an entry with key "${componentReference.key}" in the component registry.`,
    );
  }

  const ref: ServerComponentReference = {
    component: {
      key: manifest.key,
      signature: manifest.signature ?? "",
      isPublic: manifest.public,
    },
    // older versions of the manifest did not contain a key so we fall back to the componentReference key
    key: manifestEntry.key ?? componentReference.key,
  };

  const inputs = Object.entries(manifestEntry.inputs).reduce(
    (result, [key, manifestEntryInput]) => {
      const isCollection = Boolean(manifestEntryInput.collection);

      // No value/configVar/template (key omitted, or a visibility-only
      // bag): fall back to the manifest's default value, keeping any
      // visibility/writeOnly fields from the bag.
      const providedValue = componentReference.values?.[key];
      const value =
        providedValue &&
        ("value" in providedValue || "configVar" in providedValue || "template" in providedValue)
          ? providedValue
          : {
              ...providedValue,
              value: isCollection
                ? manifestEntryInput.default === ""
                  ? []
                  : manifestEntryInput.default
                : (manifestEntryInput.default ?? ""),
            };

      const type = isCollection ? "complex" : "value" in value ? "value" : "configVar";

      if ("value" in value) {
        const valueExpr =
          manifestEntryInput.collection === "keyvaluelist" && value.value instanceof Object
            ? Object.entries(value.value).map<ServerInput>(([k, v]) => ({
                name: { type: "value", value: k },
                type: "value",
                value: JSON.stringify(v),
              }))
            : manifestEntryInput.collection === "valuelist" && Array.isArray(value.value)
              ? value.value.map((v) => ({ type: "value", value: v }))
              : value.value;

        const formattedValue =
          type === "complex" || typeof valueExpr === "string"
            ? valueExpr
            : JSON.stringify(valueExpr);

        const meta: VisibilityAndPermissionValue & { writeOnly?: true } =
          convertInputPermissionAndVisibility(
            pick(value, ["permissionAndVisibilityType", "visibleToOrgDeployer"]) as {
              permissionAndVisibilityType?: PermissionAndVisibilityType;
              visibleToOrgDeployer?: boolean;
            },
          );

        const { writeOnly } = pick(value, ["writeOnly"]) as {
          writeOnly?: true;
        };

        if (writeOnly) {
          meta.writeOnly = writeOnly;
        }

        return {
          ...result,
          [key]: { type: type, value: formattedValue, meta },
        };
      }

      if ("configVar" in value) {
        return {
          ...result,
          [key]: { type: "configVar", value: value.configVar },
        };
      }

      if ("template" in value) {
        return {
          ...result,
          [key]: { type: "template", value: value.template },
        };
      }

      return result;
    },
    {},
  );

  return {
    ref,
    inputs,
  };
};

const convertComponentRegistry = (
  componentRegistry: ComponentRegistry,
  publicSupplementalComponent?: "webhook" | "schedule",
): Array<ServerComponentReference["component"]> => {
  const convertedRegistry: Array<ServerComponentReference["component"]> = Object.values(
    componentRegistry,
  ).map(({ key, public: isPublic, signature }) => ({
    key,
    isPublic,
    ...(signature ? { signature } : { version: "LATEST" }),
  }));

  if (publicSupplementalComponent) {
    convertedRegistry.push({
      key: `${publicSupplementalComponent}-triggers`,
      isPublic: true,
      version: "LATEST",
    });
  }

  return convertedRegistry;
};

/**
 * Create a reference to the private component built as part of this CNI.
 *
 * References to this component always use `version: "LATEST", isPublic: false`
 * because they automatically publish alongside the corresponding CNI yml.
 * */
const codeNativeIntegrationComponentReference = (referenceKey: string) => ({
  key: referenceKey,
  version: "LATEST" as const,
  isPublic: false,
});

/* A flow's trigger gets wrapped in a custom component if there's a defined
 * onTrigger function, or if any custom onInstance or webhook lifecycle behavior is defined.
 * */
const flowUsesWrapperTrigger = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
>(
  flow: Pick<
    Flow<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>,
    "onTrigger" | "onInstanceDelete" | "onInstanceDeploy" | "webhookLifecycleHandlers"
  >,
) => {
  return (
    typeof flow.onTrigger === "function" ||
    flow.onInstanceDelete ||
    flow.onInstanceDeploy ||
    flow.webhookLifecycleHandlers
  );
};

/** Converts typed QueueConfig to legacy format with usesFifoQueue and concurrencyLimit. */
export const convertQueueConfig = (queueConfig: QueueConfig): StandardQueueConfig => {
  if (!("type" in queueConfig)) {
    return queueConfig;
  }

  switch (queueConfig.type) {
    case "parallel":
      return { usesFifoQueue: false };

    case "throttled":
      return {
        usesFifoQueue: true,
        concurrencyLimit: queueConfig.concurrencyLimit,
        dedupeIdField: queueConfig.dedupeIdField,
      };

    case "sequential":
      return {
        usesFifoQueue: true,
        dedupeIdField: queueConfig.dedupeIdField,
      };

    default:
      return queueConfig;
  }
};

const convertFlowSchemas = (
  flowKey: string,
  schemas: Record<string, FlowDefinitionFlowSchema>,
): Record<string, FlowSchema> => {
  return Object.entries(schemas).reduce(
    (acc, [key, value]) => {
      acc[key] = {
        title: value.title || `${flowKey}-${key}`,
        type: "object",
        $comment: value.$comment,
        properties: value.properties,
        $schema: value.$schema || DEFAULT_JSON_SCHEMA_VERSION,
        ...(value.required?.length ? { required: value.required } : {}),
      };
      return acc;
    },
    {} as Record<string, FlowSchema>,
  );
};

/** Converts a Flow into the structure necessary for YAML generation. */
export const convertFlow = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
>(
  rawFlow: Flow<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>,
  componentRegistry: ComponentRegistry,
  referenceKey: string,
): Record<string, unknown> => {
  // Expand a batched `trigger` into the flat shape this function serializes. Idempotent: a flow
  // that already lacks `trigger` (including one pre-normalized by `convertIntegration`) is returned as-is.
  const flow = normalizeBatchedFlow(rawFlow);
  const result: Record<string, unknown> = {
    ...flow,
  };
  result.onTrigger = undefined;
  result.trigger = undefined;
  result.onInstanceDeploy = undefined;
  result.onInstanceDelete = undefined;
  result.webhookLifecycleHandlers = undefined;
  result.onExecution = undefined;
  result.onDeployTrigger = undefined;
  result.preprocessFlowConfig = undefined;
  result.errorConfig = undefined;
  result.testApiKeys = undefined;
  result.triggerType = undefined;

  let publicSupplementalComponent: "webhook" | "schedule" | undefined;

  const triggerStep: Record<string, unknown> = {
    name: "On Trigger",
    stableKey: `${flow.stableKey}-onTrigger`,
    description: "The function that will be executed by the flow to return an HTTP response.",
    isTrigger: true,
    errorConfig: "errorConfig" in flow ? { ...flow.errorConfig } : undefined,
  };

  const useWrapperTrigger = flowUsesWrapperTrigger(flow);

  if (isComponentReference(flow.onTrigger) && !useWrapperTrigger) {
    const { ref, inputs } = convertComponentReference(
      flow.onTrigger,
      componentRegistry,
      "triggers",
    );
    triggerStep.action = ref;
    triggerStep.inputs = inputs;
  } else if (useWrapperTrigger) {
    if (!flow.onTrigger) {
      publicSupplementalComponent = flow.schedule ? "schedule" : "webhook";
    }

    // The step action points at the CNI-generated wrapper trigger rather than
    // the referenced component's trigger. When the flow references a component
    // trigger, still carry that reference's configured input values onto the
    // step so the wrapper trigger receives them as params (and can forward them
    // to the referenced trigger via invokeTrigger).
    if (isComponentReference(flow.onTrigger)) {
      const { inputs } = convertComponentReference(flow.onTrigger, componentRegistry, "triggers");
      triggerStep.inputs = inputs;
    }

    triggerStep.action = {
      key: flowFunctionKey(flow.name, "onTrigger"),
      component: codeNativeIntegrationComponentReference(referenceKey),
    };
  } else {
    const hasSchedule = "schedule" in flow && typeof flow.schedule === "object";
    const key = hasSchedule ? "schedule" : "webhook";
    triggerStep.action = {
      key,
      component: {
        key: `${key}-triggers`,
        /**
         * TODO: Add support for specific versions of platform triggers
         */
        version: "LATEST",
        isPublic: true,
      },
    };
  }

  let hasSchedule = false;

  if ("schedule" in flow && typeof flow.schedule === "object") {
    const { schedule } = flow;
    triggerStep.schedule = {
      type: "configVar" in schedule ? "configVar" : "value",
      value: "configVar" in schedule ? schedule.configVar : schedule.value,
      meta: {
        scheduleType: "custom",
        timeZone: schedule.timezone ?? "",
      },
    };
    result.schedule = undefined;
    hasSchedule = true;
  }

  if (flow.triggerType === "polling" && !hasSchedule) {
    throw new Error(
      `${flow.name} is marked as a polling trigger but has no schedule. Polling triggers require a schedule.`,
    );
  }

  if ("queueConfig" in flow && typeof flow.queueConfig === "object") {
    const queueConfig = convertQueueConfig(flow.queueConfig);

    if (hasSchedule && queueConfig.usesFifoQueue) {
      throw new Error(
        `${flow.name} has a schedule & usesFifoQueue set to true. FIFO queues cannot be used with scheduled flows.`,
      );
    } else if (!hasSchedule && queueConfig.singletonExecutions) {
      throw new Error(
        `${flow.name} is configured for singletonExecutions but has no schedule. Unscheduled flows cannot be configured for singleton executions.`,
      );
    } else if (queueConfig.usesFifoQueue && queueConfig.singletonExecutions) {
      throw new Error(
        `${flow.name} is configured for both FIFO queues and singleton executions, but these options are mutually exclusive. Please choose one.`,
      );
    }

    if (
      queueConfig.concurrencyLimit !== undefined &&
      (queueConfig.concurrencyLimit < CONCURRENCY_LIMIT_MIN ||
        queueConfig.concurrencyLimit > CONCURRENCY_LIMIT_MAX)
    ) {
      throw new Error(
        `${flow.name} has an invalid concurrencyLimit of ${queueConfig.concurrencyLimit}. concurrencyLimit must be between ${CONCURRENCY_LIMIT_MIN} and ${CONCURRENCY_LIMIT_MAX}.`,
      );
    }

    result.queueConfig = {
      usesFifoQueue: false, // Should be false by default, even if undefined
      ...queueConfig,
      ...(queueConfig.dedupeIdField
        ? {
            dedupeIdField: {
              type: "reference",
              value: `${
                triggerStep.name ? camelCase(triggerStep.name as string) : "onTrigger"
              }.results.${queueConfig.dedupeIdField}`,
            },
          }
        : {}),
    };
  }

  const triggerResolver = "triggerResolver" in flow ? flow.triggerResolver : undefined;
  const onDeployResolver = "onDeployResolver" in flow ? flow.onDeployResolver : undefined;
  const batchConfig = "batchConfig" in flow ? flow.batchConfig : undefined;

  // Resolver behaviors (resolveItems/getNextPaginationState) are serialized onto the
  // synthesized trigger below. On the flow wire we emit only `triggerResolver`, the single
  // config the platform reads (`trigger_resolver_batch_size` / `trigger_resolver_enabled`)
  // and shares between the normal and on-deploy fires. `batchConfig`/`onDeployResolver` are
  // author-side only — clear them out of the `{ ...flow }` spread.
  result.triggerResolver = undefined;
  result.onDeployResolver = undefined;
  result.batchConfig = undefined;

  if (triggerResolver || onDeployResolver) {
    if (!batchConfig) {
      throw new Error(
        `${flow.name} defines a triggerResolver/onDeployResolver but no batchConfig. Add \`batchConfig: { batchSize }\` to the flow.`,
      );
    }

    if (
      onDeployResolver &&
      (!("onDeployTrigger" in flow) || typeof flow.onDeployTrigger !== "function")
    ) {
      throw new Error(
        `${flow.name} declares onDeployResolver without onDeployTrigger. Set onDeployTrigger to handle the initial-deploy fire that the resolver fans out.`,
      );
    }

    // `enabled: true` is required: for a "valid"-support trigger (which CNI synthesized
    // triggers are) the platform only batches when the flow's resolver is enabled.
    const concurrentBatchLimit = validateConcurrentBatchLimit(
      flow.name,
      "batchConfig",
      batchConfig.concurrentBatchLimit,
    );
    result.triggerResolver = {
      batchSize: validateBatchSize(flow.name, "batchConfig", batchConfig.batchSize),
      enabled: true,
      ...(concurrentBatchLimit !== undefined ? { concurrentBatchLimit } : {}),
    };
  }

  const actionStep: Record<string, unknown> = {
    action: {
      key: flowFunctionKey(flow.name, "onExecution"),
      component: codeNativeIntegrationComponentReference(referenceKey),
    },
    name: "On Execution",
    stableKey: `${flow.stableKey}-onExecution`,
    description: "The function that will be executed by the flow.",
    errorConfig: "errorConfig" in flow ? { ...flow.errorConfig } : undefined,
  };

  result.steps = [triggerStep, actionStep];

  result.supplementalComponents = convertComponentRegistry(
    componentRegistry,
    publicSupplementalComponent,
  );

  result.schemas = flow.schemas ? convertFlowSchemas(flow.stableKey, flow.schemas) : undefined;
  return result;
};

/** Converts an input value to the expected server type by its collection type. */
export const convertInputValue = (value: unknown, collectionType: CollectionType | undefined) => {
  if (collectionType !== "keyvaluelist") {
    return value;
  }

  if (Array.isArray(value)) {
    return value;
  }

  return Object.entries(value as object).map<KeyValuePair>(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
};

const validateOnPremConnectionConfig = (
  connection: ConfigVar,
): OnPremiseConnectionConfigTypeEnum => {
  if (isConnectionDefinitionConfigVar(connection)) {
    const hasOnPremControlledInputs = Object.values(connection.inputs).some((value) => {
      return "onPremControlled" in value && value.onPremControlled;
    });

    const { onPremConnectionConfig: config } = connection;

    if (hasOnPremControlledInputs && !config) {
      throw new Error(
        `Connection ${connection.stableKey} has onPremControlled inputs but no onPremConnectionConfig value set. Please set an onPremConnectionConfig value for the connection.`,
      );
    }

    if (!hasOnPremControlledInputs && config && config !== "disallowed") {
      throw new Error(
        `Connection ${connection.stableKey} has onPremConnectionConfig set but no onPremControlled inputs. The connection will not be valid without onPremControlled inputs (host, port).`,
      );
    }

    return hasOnPremControlledInputs && config ? config : "disallowed";
  }

  return "disallowed";
};

/** Converts a Config Var into the structure necessary for YAML generation. */
export const convertConfigVar = (
  key: string,
  configVar: ConfigVar,
  referenceKey: string,
  componentRegistry: ComponentRegistry,
): ServerRequiredConfigVariable => {
  if (isConnectionScopedConfigVar(configVar)) {
    const { stableKey } = pick(configVar, ["stableKey"]);

    return {
      key,
      stableKey,
      dataType: "connection",
      useScopedConfigVar: stableKey,
    };
  }

  const { orgOnly, meta } = convertConfigVarPermissionAndVisibility(
    pick(configVar, ["permissionAndVisibilityType", "visibleToOrgDeployer"]),
  );

  if (isConnectionDefinitionConfigVar(configVar)) {
    const { stableKey, description } = pick(configVar, ["stableKey", "description"]);

    return {
      stableKey,
      description,
      key,
      dataType: "connection",
      onPremiseConnectionConfig: validateOnPremConnectionConfig(configVar),
      connection: {
        key: camelCase(key),
        component: codeNativeIntegrationComponentReference(referenceKey),
      },
      inputs: Object.entries(configVar.inputs).reduce((result, [key, input]) => {
        // Connection template inputs are never shown in the resulting YAML.
        if (input.shown === false || "templateValue" in input) {
          return result;
        }

        const meta: VisibilityAndPermissionValue & { writeOnly?: true } =
          convertInputPermissionAndVisibility(
            pick(input, ["permissionAndVisibilityType", "visibleToOrgDeployer"]) as {
              permissionAndVisibilityType?: PermissionAndVisibilityType;
              visibleToOrgDeployer?: boolean;
            },
          );

        if (input.writeOnly) {
          meta.writeOnly = input.writeOnly;
        }

        const defaultValue = input.collection
          ? (Array.isArray(input.default) ? input.default : []).map((defaultValue) => {
              if (typeof defaultValue === "string") {
                return {
                  type: "value",
                  value: defaultValue,
                };
              }

              return {
                name: defaultValue.key,
                type: "value",
                value: defaultValue.value,
              };
            })
          : input.default || "";

        return {
          ...result,
          [key]: {
            type: input.collection ? "complex" : "value",
            value: defaultValue,
            meta,
          },
        };
      }, {}),
      orgOnly,
      meta: {
        ...meta,
        ...("oauth2Config" in configVar ? (configVar.oauth2Config ?? {}) : {}),
      },
    };
  }

  if (isConnectionReferenceConfigVar(configVar)) {
    const { ref, inputs } = convertComponentReference(
      configVar.connection,
      componentRegistry,
      "connections",
    );

    const {
      stableKey = "",
      description,
      connection: { template, onPremiseConnectionConfig },
    } = pick(configVar, ["stableKey", "description", "connection"]);

    return {
      stableKey,
      description,
      key,
      dataType: "connection",
      onPremiseConnectionConfig,
      connection: {
        ...ref,
        template,
      },
      inputs,
      orgOnly,
      meta: {
        ...meta,
        ...("oauth2Config" in configVar ? (configVar.oauth2Config ?? {}) : {}),
      },
    };
  }

  const rawDefaultValue =
    "defaultValue" in configVar
      ? convertInputValue(configVar.defaultValue, configVar.collectionType)
      : undefined;

  const defaultValue =
    typeof rawDefaultValue !== "undefined"
      ? typeof rawDefaultValue === "string"
        ? rawDefaultValue
        : JSON.stringify(rawDefaultValue)
      : undefined;

  const result = assign(
    { orgOnly, meta, key, defaultValue },
    pick(configVar, [
      "stableKey",
      "description",
      "dataType",
      "pickList",
      "timeZone",
      "codeLanguage",
      "collectionType",
    ]),
  ) as ServerDefaultRequiredConfigVariable;

  if (isScheduleConfigVar(configVar)) {
    // Mirror the low-code options: callers may supply `scheduleType`
    // explicitly ("none" / "minute" / "hour" / "day" / "week" / "custom").
    // Otherwise infer from defaultValue: a non-empty string is treated as a
    // custom CRON expression; missing/empty means "never".
    if (configVar.scheduleType) {
      result.scheduleType = configVar.scheduleType;
    } else if (typeof defaultValue === "string" && defaultValue.length > 0) {
      result.scheduleType = "custom";
    } else {
      result.scheduleType = "none";
    }
  }

  if (isJsonFormConfigVar(configVar) || isJsonFormDataSourceConfigVar(configVar)) {
    result.meta = {
      ...result.meta,
      validationMode: configVar?.validationMode ?? "ValidateAndShow",
    };
  }

  if (isJsonFormDataSourceConfigVar(configVar) && configVar.dataSourceReset) {
    result.meta = {
      ...result.meta,
      dataSourceReset: configVar.dataSourceReset.mode,
    };
    // Create placeholder inputs for each config variable dependency, so that
    // the config wizard can detect if any changed and reset the data source.
    result.inputs = (configVar.dataSourceReset.dependencies || []).reduce(
      (acc, dep, idx) => ({
        ...acc,
        [`input${idx}`]: {
          type: "configVar",
          value: dep,
        },
      }),
      {},
    );
  }

  if (isDataSourceDefinitionConfigVar(configVar)) {
    result.dataType = configVar.dataSourceType;
    result.dataSource = {
      key: camelCase(key),
      component: codeNativeIntegrationComponentReference(referenceKey),
    };
  }

  if (isDataSourceReferenceConfigVar(configVar)) {
    const { ref, inputs } = convertComponentReference(
      configVar.dataSource,
      componentRegistry,
      "dataSources",
    );
    result.dataType =
      componentRegistry[configVar.dataSource.component].dataSources[ref.key].dataSourceType;
    result.dataSource = ref;
    result.inputs = inputs;

    if (configVar.validationMode) {
      result.meta = {
        ...result.meta,
        validationMode: configVar.validationMode,
      };
    }

    if (configVar.dataSourceReset) {
      result.meta = {
        ...result.meta,
        dataSourceReset: configVar.dataSourceReset.mode,
      };
    }
  }

  return result;
};

/** Maps the step name field to a fully qualified input. */
const fieldNameToReferenceInput = (
  stepName: string,
  fieldName: string | null | undefined,
): ServerInput | undefined =>
  fieldName ? { type: "reference", value: `${stepName}.results.${fieldName}` } : undefined;

/** Actions and Triggers will be scoped to their flow by combining the flow
 *  name and the function name. This is to ensure that the keys are unique
 *  on the resulting object, which will be turned into a Component. */
const flowFunctionKey = (flowName: string, functionName: "onExecution" | "onTrigger"): string => {
  const flowKey = flowName
    .replace(/[^0-9a-zA-Z]+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");

  return `${flowKey}_${functionName}`;
};

/* Generates component argument for invokeTrigger calls. */
export const invokeTriggerComponentInput = (
  componentRef: ServerComponentReference,
  onTrigger: TriggerReference | undefined,
  eventName:
    | "perform"
    | "onInstanceDeploy"
    | "onInstanceDelete"
    | "webhookCreate"
    | "webhookDelete",
) => {
  const { component } = componentRef;
  const inputComponent =
    "signature" in componentRef.component
      ? {
          key: component.key,
          signature:
            "signature" in component &&
            component.signature !== null &&
            component.signature !== void 0
              ? component.signature
              : "",
          isPublic: component.isPublic,
        }
      : component;
  return {
    component: inputComponent,
    key: onTrigger ? onTrigger.key : componentRef.key,
    triggerEventFunctionName: eventName,
  };
};

/* When a flow references a component trigger but also defines on* lifecycle
 * behavior, the trigger is wrapped in a generated CNI component trigger. That
 * wrapper must declare the referenced trigger's inputs so the platform passes
 * the step's configured values through as params (which the wrapper then
 * forwards to the referenced trigger via invokeTrigger). */
const wrapperTriggerInputsFromReference = (
  onTrigger: unknown,
  componentRegistry: ComponentRegistry,
): ServerTriggerInput[] => {
  if (!isComponentReference(onTrigger)) {
    return [];
  }

  const manifestInputs = componentRegistry[onTrigger.component]?.triggers?.[onTrigger.key]?.inputs;
  if (!manifestInputs) {
    return [];
  }

  return Object.entries(manifestInputs).map(([key, input]) => ({
    key,
    label: key,
    type: input.inputType,
    ...(input.collection ? { collection: input.collection } : {}),
    ...(input.default !== undefined ? { default: input.default } : {}),
    ...(input.required !== undefined ? { required: input.required } : {}),
  }));
};

type ComponentRefTrigger = "component-ref";

type PreValidationTriggerPerformConfig<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
> = {
  componentRef: ServerComponentReference | undefined;
  onTrigger:
    | TriggerReference
    | TriggerPerformFunction<TInputs, TConfigVars, TAllowsBranching, TResult>
    | PollingTriggerPerformFunction<
        TInputs,
        TActionInputs,
        TConfigVars,
        TPayload,
        TAllowsBranching,
        TResult
      >
    | undefined;
  componentRegistry: ComponentRegistry;
  triggerType: FlowTriggerType | undefined;
};

interface GenerateTriggerPerformFn<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TAllowsBranching extends boolean | undefined,
  TResult extends TriggerPerformResult<TAllowsBranching, TriggerPayload>,
> {
  componentRef: undefined;
  onTrigger: TriggerPerformFunction<TInputs, TConfigVars, TAllowsBranching, TResult>;
  componentRegistry: ComponentRegistry;
  triggerType: StandardTriggerType;
}

interface GenerateComponentRefTriggerPerformFn {
  componentRef: ServerComponentReference;
  onTrigger: TriggerReference;
  componentRegistry: ComponentRegistry;
  triggerType: ComponentRefTrigger;
}

interface GeneratePollingTriggerPerformFn<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
> {
  onTrigger: PollingTriggerPerformFunction<
    TInputs,
    TActionInputs,
    TConfigVars,
    TPayload,
    TAllowsBranching,
    TResult
  >;
  componentRef: undefined;
  componentRegistry: ComponentRegistry;
  triggerType: PollingTriggerType;
}

/** Type guard to narrow trigger perform functions based on triggerType.
 * Since TriggerPerformFunction and CodeNativePollingTriggerPerformFunction are
 * structurally identical, TypeScript cannot distinguish them. This guard uses
 * triggerType to narrow the function type. */
const isStandardTriggerPerform = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
>(
  fn:
    | TriggerPerformFunction<TInputs, TConfigVars, TAllowsBranching, TResult>
    | PollingTriggerPerformFunction<
        TInputs,
        TActionInputs,
        TConfigVars,
        TPayload,
        TAllowsBranching,
        TResult
      >,
  triggerType: FlowTriggerType | undefined,
): fn is TriggerPerformFunction<TInputs, TConfigVars, TAllowsBranching, TResult> =>
  triggerType !== "polling";

// Force incoming config into a discriminated union type to simplify downstream handling
function validateTriggerPerformConfig<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
>(
  params: PreValidationTriggerPerformConfig<
    TInputs,
    TActionInputs,
    TConfigVars,
    TPayload,
    TAllowsBranching,
    TResult
  >,
):
  | GenerateTriggerPerformFn<TInputs, TConfigVars, TAllowsBranching, TResult>
  | GeneratePollingTriggerPerformFn<
      TInputs,
      TActionInputs,
      TConfigVars,
      TPayload,
      TAllowsBranching,
      TResult
    >
  | GenerateComponentRefTriggerPerformFn {
  const { componentRef, onTrigger, componentRegistry, triggerType } = params;
  if (componentRef && onTrigger && typeof onTrigger !== "function") {
    return {
      componentRef,
      onTrigger,
      triggerType: "component-ref",
      componentRegistry,
    };
  } else if (triggerType === "polling" && typeof onTrigger === "function") {
    return {
      componentRef: undefined,
      onTrigger,
      triggerType,
      componentRegistry,
    };
  } else if (typeof onTrigger === "function" && isStandardTriggerPerform(onTrigger, triggerType)) {
    return {
      componentRef: undefined,
      onTrigger,
      triggerType: "standard",
      componentRegistry,
    };
  } else {
    throw new Error(`Invalid trigger configuration detected: ${JSON.stringify(params, null, 2)}`);
  }
}

/* Generates a wrapper function that calls an existing component trigger's perform. */
function generateTriggerPerformFn<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
>(
  params: PreValidationTriggerPerformConfig<
    TInputs,
    TActionInputs,
    TConfigVars,
    TPayload,
    TAllowsBranching,
    TResult
  >,
):
  | TriggerPerformFunction<TInputs, TConfigVars, TAllowsBranching, TResult>
  | CNIPollingPerformFunction<TInputs, TConfigVars, TPayload, TAllowsBranching>
  | ComponentRefTriggerPerformFunction<TInputs, TConfigVars> {
  const { componentRef, onTrigger, componentRegistry, triggerType } =
    validateTriggerPerformConfig(params);
  switch (triggerType) {
    case "polling":
      return createCNIPollingPerform({ onTrigger, componentRegistry });
    case "standard":
      return createCNIPerform({ componentRegistry, onTrigger });
    case "component-ref":
      return createCNIComponentRefPerform({
        componentRegistry,
        componentRef,
        onTrigger,
      });

    default:
      throw new Error(`Invalid trigger configuration detected: ${JSON.stringify(params, null, 2)}`);
  }
}

export type TriggerActionInvokeFunction = (
  ref: {
    component: ServerComponentReference["component"];
    key: string;
    triggerEventFunctionName:
      | "perform"
      | "onInstanceDeploy"
      | "onInstanceDelete"
      | "webhookCreate"
      | "webhookDelete";
  },
  context: ActionContext,
  payload: TriggerPayload | null,
  params: Record<string, unknown>,
) => Promise<TriggerResult>;

/** Generates a wrapper function that calls an existing component's trigger event function
 * (onInstanceDeploy, onInstanceDelete, webhookCreate, or webhookDelete), then calls
 * the flow-defined version if it exists.
 * Returns the deep-merged results of the two, prioritizing the custom response
 * if there's a conflict. */
const generateTriggerEventWrapperFn = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
>(
  componentRef: ServerComponentReference | undefined,
  onTrigger:
    | TriggerReference
    | TriggerPerformFunction<TInputs, TConfigVars, TAllowsBranching, TResult>
    | PollingTriggerPerformFunction<
        TInputs,
        TActionInputs,
        TConfigVars,
        TPayload,
        TAllowsBranching,
        TResult
      >
    | undefined,
  eventName: "onInstanceDeploy" | "onInstanceDelete" | "webhookCreate" | "webhookDelete",
  componentRegistry: ComponentRegistry,
  customFn?: TriggerEventFunction,
): TriggerEventFunction | undefined => {
  const usesComponentRef = componentRef && typeof onTrigger !== "function";

  if (usesComponentRef) {
    return async (context, params) => {
      // @ts-expect-error: _components isn't part of the public API
      const _components = context._components ?? {
        invokeTrigger: () => {},
      };
      const invokeTrigger: TriggerActionInvokeFunction = _components.invokeTrigger;
      const cniContext = createCNIContext(context, componentRegistry);

      // Using runWithContext allows for component action invocation via manifest.
      return await runWithContext(cniContext, async () => {
        const invokeResponse =
          (await invokeTrigger(
            invokeTriggerComponentInput(componentRef, onTrigger, eventName),
            cniContext,
            null,
            params,
          )) || {};

        let customResponse: TriggerEventFunctionReturn = {};
        if (customFn) {
          customResponse = (await customFn(cniContext, params)) || {};
        }

        return merge(invokeResponse, customResponse);
      });
    };
  } else if (customFn) {
    return async (context, params) => {
      const cniContext = createCNIContext(context, componentRegistry);
      // Using runWithContext allows for component action invocation via manifest.
      return await runWithContext(cniContext, async () => {
        return await customFn(cniContext, params);
      });
    };
  } else {
    return;
  }
};

const convertOnExecution =
  (
    onExecution: ActionPerformFunction,
    componentRegistry: ComponentRegistry,
  ): ServerActionPerformFunction =>
  async (context, params) => {
    const actionContext = createCNIContext(context, componentRegistry);

    // Using runWithContext allows for component action invocation via manifest.
    const result = await runWithContext(actionContext, async () => {
      return await onExecution(actionContext, params);
    });

    logDebugResults(actionContext);

    return result;
  };

/** Creates the structure necessary to import a Component as part of a
 *  Code Native integration. */
const codeNativeIntegrationComponent = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
>(
  {
    name,
    iconPath,
    description,
    flows: rawFlows = [],
    componentRegistry = {},
  }: IntegrationDefinition<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>,
  referenceKey: string,
  configVars: Record<string, ConfigVar>,
): ServerComponent<
  TInputs,
  TActionInputs,
  ConfigVarResultCollection,
  TPayload,
  TAllowsBranching,
  TResult
> => {
  // Expand any batched `trigger` so the action/trigger reducers below see the flat shape.
  const flows = rawFlows.map((flow) => normalizeBatchedFlow(flow));

  const convertedActions = flows.reduce<Record<string, ServerAction>>(
    (result, { name, onExecution }) => {
      const key = flowFunctionKey(name, "onExecution");
      return {
        ...result,
        [key]: {
          key,
          display: {
            label: `${name} - onExecution`,
            description: "The function that will be executed by the flow.",
          },
          perform: convertOnExecution(
            onExecution as ServerActionPerformFunction,
            componentRegistry,
          ),
          inputs: [],
        },
      };
    },
    {},
  );

  const convertedTriggers = flows.reduce<
    Record<
      string,
      ServerTrigger<
        TInputs,
        TActionInputs,
        ConfigVarResultCollection,
        TPayload,
        TAllowsBranching,
        TResult
      >
    >
  >((result, flow) => {
    const {
      name,
      onTrigger,
      onInstanceDeploy,
      onInstanceDelete,
      webhookLifecycleHandlers,
      schedule,
      triggerType,
      onDeployTrigger,
    } = flow;
    // `batchConfig`/`triggerResolver`/`onDeployResolver` are wire-only fields synthesized by
    // `normalizeBatchedFlow`; they aren't on the author-facing `Flow` type, so read via cast.
    const { batchConfig, triggerResolver, onDeployResolver } = flow as typeof flow & {
      batchConfig?: { batchSize: number; concurrentBatchLimit?: number };
      triggerResolver?: WireResolver;
      onDeployResolver?: WireResolver;
    };
    if (
      !flowUsesWrapperTrigger({
        onTrigger,
        onInstanceDelete,
        onInstanceDeploy,
        webhookLifecycleHandlers,
      })
    ) {
      // In this scenario, the user has defined an existing component trigger
      // without any custom behavior, so we don't need to wrap anything.
      return result;
    }

    const key = flowFunctionKey(name, "onTrigger");
    const defaultComponentKey = schedule && typeof schedule === "object" ? "schedule" : "webhook";
    const defaultComponentRef: ServerComponentReference = {
      component: {
        key: `${defaultComponentKey}-triggers`,
        version: "LATEST",
        isPublic: true,
      },
      key: defaultComponentKey,
    };

    // The component ref here is undefined if onTrigger is a function.
    const { ref } = isComponentReference(onTrigger)
      ? convertComponentReference(onTrigger, componentRegistry, "triggers")
      : { ref: onTrigger ? undefined : defaultComponentRef };

    const performFn = generateTriggerPerformFn({
      componentRef: ref,
      onTrigger,
      componentRegistry,
      triggerType,
    });
    const deleteFn = generateTriggerEventWrapperFn(
      ref,
      onTrigger,
      "onInstanceDelete",
      componentRegistry,
      onInstanceDelete,
    );
    const deployFn = generateTriggerEventWrapperFn(
      ref,
      onTrigger,
      "onInstanceDeploy",
      componentRegistry,
      onInstanceDeploy,
    );
    const webhookCreateFn = generateTriggerEventWrapperFn(
      ref,
      onTrigger,
      "webhookCreate",
      componentRegistry,
      webhookLifecycleHandlers?.create,
    );
    const webhookDeleteFn = generateTriggerEventWrapperFn(
      ref,
      onTrigger,
      "webhookDelete",
      componentRegistry,
      webhookLifecycleHandlers?.delete,
    );

    return {
      ...result,
      [key]: {
        key,
        display: {
          label: `${name} - onTrigger`,
          description: "The function that will be executed by the flow to return an HTTP response.",
        },
        perform: performFn,
        onInstanceDeploy: deployFn,
        hasOnInstanceDeploy: !!deployFn,
        onInstanceDelete: deleteFn,
        hasOnInstanceDelete: !!deleteFn,
        webhookCreate: webhookCreateFn,
        hasWebhookCreateFunction: !!webhookCreateFn,
        webhookDelete: webhookDeleteFn,
        hasWebhookDeleteFunction: !!webhookDeleteFn,
        inputs: wrapperTriggerInputsFromReference(onTrigger, componentRegistry),
        scheduleSupport: triggerType === "polling" ? "required" : "valid",
        synchronousResponseSupport: "valid",
        isPollingTrigger: triggerType === "polling",
        triggerResolverSupport: triggerResolver ? "valid" : "invalid",
        // The authoritative batch size is stored on the flow (see convertFlow). We also
        // emit the single shared default on the synthesized trigger because component
        // publish validation requires `triggerResolverDefaultBatchSize` whenever resolver
        // support is active; both derive from the one `flow.batchConfig`.
        ...(triggerResolver || onDeployResolver
          ? {
              triggerResolverDefaultBatchSize: batchConfig?.batchSize ?? 1,
              ...(batchConfig?.concurrentBatchLimit !== undefined
                ? {
                    triggerResolverDefaultConcurrentBatchLimit: batchConfig.concurrentBatchLimit,
                  }
                : {}),
            }
          : {}),
        ...(triggerResolver
          ? {
              ...(triggerResolver.resolveItems
                ? {
                    resolveTriggerItems: triggerResolver.resolveItems,
                    hasResolveTriggerItems: true,
                  }
                : {}),
              ...(triggerResolver.getNextPaginationState
                ? {
                    getNextPaginationState: triggerResolver.getNextPaginationState,
                    hasGetNextDiscoveryState: true,
                  }
                : {}),
            }
          : {}),
        // On-deploy is presence-driven (no support flag): the behavior flags below
        // (hasOnDeployPerform / hasResolveOnDeployItems) tell the platform what runs.
        ...(onDeployTrigger
          ? {
              onDeployPerform: createCNIPerform({
                componentRegistry,
                onTrigger: onDeployTrigger,
              }),
              hasOnDeployPerform: true,
            }
          : {}),
        ...(onDeployResolver
          ? {
              ...(onDeployResolver.resolveItems
                ? {
                    resolveOnDeployItems: onDeployResolver.resolveItems,
                    hasResolveOnDeployItems: true,
                  }
                : {}),
              ...(onDeployResolver.getNextPaginationState
                ? {
                    getOnDeployNextPaginationState: onDeployResolver.getNextPaginationState,
                    hasGetOnDeployNextDiscoveryState: true,
                  }
                : {}),
            }
          : {}),
      },
    };
  }, {});

  const convertedDataSources = Object.entries(configVars).reduce<Record<string, ServerDataSource>>(
    (result, [key, configVar]) => {
      if (!isDataSourceDefinitionConfigVar(configVar)) {
        return result;
      }

      const camelKey = camelCase(key);
      const dataSource = pick(configVar, ["perform", "dataSourceType"]);

      return {
        ...result,
        [camelKey]: {
          ...dataSource,
          key: camelKey,
          display: {
            label: key,
            description: key,
          },
          inputs:
            // Create placeholder inputs for each config variable dependency,so that
            // the config wizard can detect if any changed and reset the data source.
            isJsonFormDataSourceConfigVar(configVar) && configVar.dataSourceReset
              ? (configVar.dataSourceReset.dependencies || []).map((dep, idx) => ({
                  key: `input${idx}`,
                  label: dep,
                  type: "string",
                }))
              : [],
        },
      };
    },
    {},
  );

  const convertedConnections = Object.entries(configVars).reduce<ServerConnection[]>(
    (result, [key, configVar]) => {
      if (!isConnectionDefinitionConfigVar(configVar)) {
        return result;
      }

      const convertedInputs = Object.entries(configVar.inputs).map(([key, value]) => {
        if ("templateValue" in value) {
          return convertTemplateInput(key, value as ConnectionTemplateInputField, configVar.inputs);
        }

        return convertInput(key, value);
      });

      const connection = pick(configVar, ["oauth2Type", "oauth2PkceMethod"]);
      const { avatarPath: avatarIconPath, oauth2ConnectionIconPath: iconPath } =
        configVar.icons ?? {};

      return [
        ...result,
        {
          ...connection,
          iconPath,
          avatarIconPath,
          inputs: convertedInputs,
          key: camelCase(key),
          label: key,
        },
      ];
    },
    [],
  );

  return {
    key: referenceKey,
    display: {
      label: referenceKey,
      iconPath,
      description: description || name,
    },
    connections: convertedConnections,
    actions: convertedActions,
    triggers: convertedTriggers,
    dataSources: convertedDataSources,
  };
};

const codeNativeIntegrationPublishingMetadata = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerPerformResult<TAllowsBranching, TPayload> = TriggerPerformResult<
    TAllowsBranching,
    TPayload
  >,
>(
  definition: IntegrationDefinition<TInputs, TActionInputs, TPayload, TAllowsBranching, TResult>,
): PublishingMetadata => {
  const customerRequiredSecurityEndpoints = definition.flows
    .filter((flow) => flow.endpointSecurityType === "customer_required")
    .map(({ name, testApiKeys }) => {
      return { name, testApiKeys };
    });

  return {
    flowsWithCustomerRequiredAPIKeys: customerRequiredSecurityEndpoints,
  };
};
