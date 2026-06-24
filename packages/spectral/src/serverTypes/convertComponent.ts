import omit from "lodash/omit";
import {
  type ActionDefinition,
  type ComponentDefinition,
  type ComponentHooks,
  type ConfigVarResultCollection,
  type ConnectionDefinition,
  type ConnectionInput,
  type ConnectionTemplateInputField,
  type DataSourceDefinition,
  InputFieldDefaultMap,
  type InputFieldDefinition,
  type Inputs,
  type OnPremConnectionInput,
  type OutputSchema,
  type TriggerDefinition,
  type TriggerOptionChoice,
  type TriggerPayload,
  type TriggerResult,
} from "../types";
import {
  isPollingTriggerDefinition,
  type PollingTriggerDefinition,
} from "../types/PollingTriggerDefinition";
import type { BatchConfig, TriggerResolverBehavior } from "../types/TriggerDefinition";
import type {
  Action as ServerAction,
  Component as ServerComponent,
  Connection as ServerConnection,
  DataSource as ServerDataSource,
  Input as ServerInput,
  ServerOutputSchema,
  Trigger as ServerTrigger,
} from ".";
import {
  type CleanFn,
  cleanParams,
  createPerform,
  createPollingPerform,
  type InputCleaners,
  type PerformFn,
} from "./perform";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Auto-generated cleaner for structuredObject/dynamicObject containers.
 * Recursively delegates to each child's clean function. Developers do not
 * declare a top-level clean on these containers — the conversion always
 * supplies one so nested clean functions are applied at runtime. */
export const cleanerFor = (input: InputFieldDefinition): CleanFn | undefined => {
  if (input.type === "structuredObject") {
    const childCleaners = Object.entries(input.inputs).reduce<InputCleaners>(
      (acc, [childKey, childDef]) => ({
        ...acc,
        [childKey]: cleanerFor(childDef as InputFieldDefinition),
      }),
      {},
    );
    const cleanRecord = (value: unknown) =>
      isPlainObject(value) ? cleanParams(value, childCleaners) : value;
    if (input.collection === "valuelist") {
      return (value: unknown) => (Array.isArray(value) ? value.map(cleanRecord) : value);
    }
    if (input.collection === "keyvaluelist") {
      // Entries arrive as KeyValuePair envelopes; the object to clean
      // lives under `value`.
      return (value: unknown) =>
        Array.isArray(value)
          ? value.map((entry) =>
              isPlainObject(entry) && "value" in entry
                ? { ...entry, value: cleanRecord(entry.value) }
                : entry,
            )
          : value;
    }
    return cleanRecord;
  }

  if (input.type === "dynamicObject") {
    const configCleaners: Record<string, InputCleaners> = {};
    for (const [configKey, configDef] of Object.entries(input.configurations)) {
      configCleaners[configKey] = Object.entries(configDef.inputs).reduce<InputCleaners>(
        (acc, [childKey, childDef]) => ({
          ...acc,
          [childKey]: cleanerFor(childDef as InputFieldDefinition),
        }),
        {},
      );
    }
    return (value: unknown) => {
      if (!isPlainObject(value)) {
        return value;
      }
      const { configuration, values } = value as {
        configuration?: unknown;
        values?: unknown;
      };
      if (typeof configuration !== "string") {
        return value;
      }
      const cleaners = configCleaners[configuration];
      if (!cleaners) {
        return { configuration, values };
      }
      return {
        configuration,
        values: isPlainObject(values) ? cleanParams(values, cleaners) : values,
      };
    };
  }

  return "clean" in input ? (input.clean as CleanFn) : undefined;
};

/**
 * Throws if `batchSize` isn't a positive integer; otherwise returns it. Shared by the
 * component-trigger (`TriggerDefinition.batch.batchSize`) and CNI flow (`flow.batch.batchSize`)
 * validation paths.
 */
export const validateBatchSize = (
  ownerLabel: string,
  fieldName: string,
  batchSize: unknown,
): number => {
  if (typeof batchSize !== "number" || !Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(
      `${ownerLabel} has an invalid ${fieldName} batchSize of ${String(batchSize)}. batchSize must be an integer >= 1.`,
    );
  }
  return batchSize;
};

/**
 * Throws if `concurrentBatchLimit` is set but isn't a positive integer; returns it
 * unchanged (including `undefined`, which the platform treats as unlimited). Shared by the
 * component-trigger and CNI flow paths, both sourcing it from the single `batchConfig`.
 */
export const validateConcurrentBatchLimit = (
  ownerLabel: string,
  fieldName: string,
  concurrentBatchLimit: unknown,
): number | undefined => {
  if (concurrentBatchLimit === undefined) {
    return undefined;
  }
  if (
    typeof concurrentBatchLimit !== "number" ||
    !Number.isInteger(concurrentBatchLimit) ||
    concurrentBatchLimit < 1
  ) {
    throw new Error(
      `${ownerLabel} has an invalid ${fieldName} concurrentBatchLimit of ${String(concurrentBatchLimit)}. concurrentBatchLimit must be an integer >= 1.`,
    );
  }
  return concurrentBatchLimit;
};

/**
 * Emits the trigger's single default batch size to the one wire field the platform reads
 * (`triggerResolverDefaultBatchSize`), shared by both the trigger and on-deploy resolution.
 * Emitted when the trigger declares a resolver — `triggerResolverSupport` `"valid"`/`"required"`
 * for the normal path, or an `onDeployResolver` for the on-deploy path. Defaults to 1 when no
 * `batchConfig` was declared.
 */
const buildBatchDefaultField = (
  triggerLabel: string,
  triggerResolverSupport: TriggerOptionChoice,
  hasOnDeployResolver: boolean,
  batchConfig: BatchConfig | undefined,
) => {
  if (triggerResolverSupport === "invalid" && !hasOnDeployResolver) {
    return {};
  }
  const concurrentBatchLimit = batchConfig
    ? validateConcurrentBatchLimit(
        `Trigger "${triggerLabel}"`,
        "batchConfig",
        batchConfig.concurrentBatchLimit,
      )
    : undefined;
  return {
    triggerResolverDefaultBatchSize: batchConfig
      ? validateBatchSize(`Trigger "${triggerLabel}"`, "batchConfig", batchConfig.batchSize)
      : 1,
    ...(concurrentBatchLimit !== undefined
      ? { triggerResolverDefaultConcurrentBatchLimit: concurrentBatchLimit }
      : {}),
  };
};

const buildTriggerResolverFields = <
  TConfigVars extends ConfigVarResultCollection,
  TPayload extends TriggerPayload,
>(
  resolver: TriggerResolverBehavior<TConfigVars, TPayload> | undefined,
) => {
  if (!resolver) {
    return {};
  }
  const { resolveItems, getNextPaginationState } = resolver;
  return {
    ...(resolveItems
      ? {
          resolveTriggerItems: resolveItems,
          hasResolveTriggerItems: true,
        }
      : {}),
    ...(getNextPaginationState
      ? {
          getNextPaginationState,
          hasGetNextDiscoveryState: true,
        }
      : {}),
  };
};

const buildOnDeployResolverFields = <
  TConfigVars extends ConfigVarResultCollection,
  TPayload extends TriggerPayload,
>(
  resolver: TriggerResolverBehavior<TConfigVars, TPayload> | undefined,
) => {
  if (!resolver) {
    return {};
  }
  const { resolveItems, getNextPaginationState } = resolver;
  return {
    ...(resolveItems
      ? {
          resolveOnDeployItems: resolveItems,
          hasResolveOnDeployItems: true,
        }
      : {}),
    ...(getNextPaginationState
      ? {
          getOnDeployNextPaginationState: getNextPaginationState,
          hasGetOnDeployNextDiscoveryState: true,
        }
      : {}),
  };
};

export const convertInput = (
  key: string,
  definition: InputFieldDefinition | OnPremConnectionInput | ConnectionInput,
): ServerInput => {
  // Cast: the field union is wider than any single member; runtime guards below handle it.
  const {
    default: defaultValue,
    type,
    label,
    collection,
    inputs: childInputs,
    configurations,
    ...rest
  } = definition as {
    default?: unknown;
    type: InputFieldDefinition["type"] | "template";
    label: string | { key: string; value: string };
    collection?: "valuelist" | "keyvaluelist";
    inputs?: Record<string, InputFieldDefinition>;
    configurations?: Record<
      string,
      {
        label: string | { key: string; value: string };
        comments?: string;
        inputs: Record<string, InputFieldDefinition>;
      }
    >;
    [key: string]: unknown;
  };
  const keyLabel =
    collection === "keyvaluelist" && typeof label === "object" ? label.key : undefined;

  const nestedInputs =
    type === "structuredObject" && childInputs
      ? Object.entries(childInputs).map(([childKey, childDef]) =>
          convertInput(childKey, childDef as InputFieldDefinition),
        )
      : type === "dynamicObject" && configurations
        ? Object.entries(configurations).map(([configKey, configDef]) => ({
            key: configKey,
            type: "structuredObject",
            label: typeof configDef.label === "string" ? configDef.label : configDef.label.value,
            comments: configDef.comments,
            inputs: Object.entries(configDef.inputs).map(([childKey, childDef]) =>
              convertInput(childKey, childDef as InputFieldDefinition),
            ),
          }))
        : undefined;

  return {
    ...omit(rest, [
      "onPremControlled",
      "permissionAndVisibilityType",
      "visibleToOrgDeployer",
      "writeOnly",
    ]),
    key,
    type,
    default: defaultValue ?? InputFieldDefaultMap[type],
    collection,
    label: typeof label === "string" ? label : label.value,
    keyLabel,
    onPremiseControlled: rest.onPremControlled === true ? true : undefined,
    inputs: nestedInputs,
  };
};

const TEMPLATE_VALUE_REGEX = /{{#(\w+)}}/g;
const TEMPLATE_VALUE_ERRORS = {
  NO_SLOTS:
    "No template slots were found. Declare a template slot with this notation: {{#someInputKey}}",
  INVALID_KEYS:
    "Invalid keys were found in the template string. All referenced keys must be non-template inputs declared in the first argument:",
};

export const _isValidTemplateValue = (
  template: string,
  inputs: { [key: string]: ConnectionInput | ConnectionTemplateInputField },
): {
  isValid: boolean;
  error?: string;
} => {
  const matches = [...template.matchAll(TEMPLATE_VALUE_REGEX)];

  if (matches.length === 0) {
    return {
      isValid: false,
      error: TEMPLATE_VALUE_ERRORS.NO_SLOTS,
    };
  }

  const invalidKeys: Array<string> = [];
  for (const [_substr, key] of matches) {
    if (!inputs[key] || inputs[key].type === "template") {
      invalidKeys.push(key);
    }
  }

  if (invalidKeys.length > 0) {
    return {
      isValid: false,
      error: `${TEMPLATE_VALUE_ERRORS.INVALID_KEYS} ${invalidKeys}`,
    };
  }

  return {
    isValid: true,
  };
};

export const convertTemplateInput = (
  key: string,
  { templateValue, label, ...rest }: ConnectionTemplateInputField,
  inputs: { [key: string]: ConnectionInput | ConnectionTemplateInputField },
): ServerInput => {
  const validation = _isValidTemplateValue(templateValue, inputs);
  if (!validation.isValid) {
    throw `Template input "${key}": ${validation.error}`;
  }

  return {
    ...omit(rest, ["permissionAndVisibilityType", "visibleToOrgDeployer", "writeOnly"]),
    key,
    type: "template",
    default: templateValue ?? "",
    label: typeof label === "string" ? label : label.value,
    shown: false,
  };
};

const convertOutputSchema = (outputSchema: OutputSchema): ServerOutputSchema => {
  if (outputSchema.type === "actionOutput") {
    return { type: "actionOutput", schema: JSON.stringify(outputSchema.schema) };
  }
  return {
    type: "branchingOutput",
    branchSchemas: Object.entries(outputSchema.branchSchemas).map(([name, schema]) => ({
      name,
      schema: JSON.stringify(schema),
    })),
  };
};

export const convertAction = (
  actionKey: string,
  {
    inputs = {},
    perform,
    outputSchema,
    experimentalExamplePerform,
    ...action
  }: ActionDefinition<Inputs, any, boolean, any>,
  hooks?: ComponentHooks,
): ServerAction => {
  const convertedInputs = Object.entries(inputs).map(([key, value]) => convertInput(key, value));
  const inputCleaners = Object.entries(inputs).reduce<InputCleaners>(
    (result, [key, value]) => ({ ...result, [key]: cleanerFor(value) }),
    {},
  );

  return {
    ...action,
    key: actionKey,
    inputs: convertedInputs,
    perform: createPerform(perform, {
      inputCleaners,
      errorHandler: hooks?.error,
    }),
    ...(outputSchema ? { outputSchema: convertOutputSchema(outputSchema) } : {}),
    ...(experimentalExamplePerform
      ? {
          experimentalExamplePerform: createPerform(experimentalExamplePerform, {
            inputCleaners,
            errorHandler: hooks?.error,
          }),
        }
      : {}),
  };
};

export const convertTrigger = <
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
>(
  triggerKey: string,
  // `any` is load-bearing: the user-facing TriggerDefinition / PollingTriggerDefinition
  // type their event-function fields (onInstanceDeploy, webhookLifecycleHandlers, etc.) over
  // TInputs/TConfigVars/TPayload, while the wire-format ServerTrigger drops those generics.
  // The `...trigger` spread in the result construction below would surface variance errors
  // without these `any`s. The user-typed handlers are immediately replaced with
  // createPerform-wrapped versions, so the loose input typing is safe in practice.
  trigger:
    | TriggerDefinition<any>
    | PollingTriggerDefinition<any, ConfigVarResultCollection, TriggerPayload, boolean, any, any>,
  hooks?: ComponentHooks,
): ServerTrigger<TInputs, TActionInputs, TConfigVars, TPayload, TAllowsBranching, TResult> => {
  const { onInstanceDeploy, onInstanceDelete } = trigger;
  const webhookLifecycleHandlers =
    "webhookLifecycleHandlers" in trigger ? trigger.webhookLifecycleHandlers : undefined;
  const inputs: Inputs = trigger.inputs ?? {};

  const triggerInputKeys = Object.keys(inputs);
  const convertedTriggerInputs = Object.entries(inputs).map(([key, value]) => {
    return convertInput(key, value);
  });

  const triggerInputCleaners = Object.entries(inputs).reduce<InputCleaners>(
    (result, [key, value]) => ({ ...result, [key]: cleanerFor(value) }),
    {},
  );

  let scheduleSupport: TriggerOptionChoice =
    "scheduleSupport" in trigger ? trigger.scheduleSupport : "invalid";

  const batchConfig = "batchConfig" in trigger ? trigger.batchConfig : undefined;
  const triggerResolver = "triggerResolver" in trigger ? trigger.triggerResolver : undefined;
  const triggerResolverSupport: TriggerOptionChoice =
    "triggerResolverSupport" in trigger && trigger.triggerResolverSupport !== undefined
      ? trigger.triggerResolverSupport
      : triggerResolver
        ? "valid"
        : "invalid";
  if (triggerResolverSupport === "required" && !triggerResolver) {
    throw new Error(
      `Trigger "${trigger.display.label}" declares triggerResolverSupport "required" but is missing triggerResolver.`,
    );
  }
  if (triggerResolverSupport === "invalid" && triggerResolver) {
    throw new Error(
      `Trigger "${trigger.display.label}" declares triggerResolver but triggerResolverSupport is "invalid".`,
    );
  }

  const onDeployPerform = "onDeployPerform" in trigger ? trigger.onDeployPerform : undefined;
  const onDeployResolver = "onDeployResolver" in trigger ? trigger.onDeployResolver : undefined;
  // On-deploy is presence-driven (no support flag): a trigger that defines an
  // `onDeployResolver` must also define the `onDeployPerform` fire it batches.
  if (onDeployResolver?.resolveItems && !onDeployPerform) {
    throw new Error(
      `Trigger "${trigger.display.label}" declares onDeployResolver.resolveItems but is missing onDeployPerform.`,
    );
  }

  let convertedActionInputs: Array<ServerInput> = [];
  let performToUse: PerformFn;

  if (isPollingTriggerDefinition(trigger)) {
    const { pollAction: action } = trigger;
    let actionInputCleaners: InputCleaners = {};
    scheduleSupport = "required";

    if (action) {
      convertedActionInputs = Object.entries(action.inputs).reduce<Array<ServerInput>>(
        (accum, [key, value]) => {
          if (triggerInputKeys.includes(key)) {
            throw new Error(
              `The pollingTrigger "${trigger.display.label}" was defined with an input with the key: ${key}. This key duplicates an input on the associated "${action.display.label}" action. Please assign the trigger input a different key.`,
            );
          }

          accum.push(convertInput(key, value as InputFieldDefinition));
          return accum;
        },
        [],
      );

      actionInputCleaners = Object.entries(action.inputs).reduce<InputCleaners>(
        (result, [key, value]) => ({
          ...result,
          [key]: cleanerFor(value as InputFieldDefinition),
        }),
        {},
      );
    }

    const combinedCleaners = Object.assign({}, actionInputCleaners, triggerInputCleaners);

    performToUse = createPollingPerform(trigger, {
      inputCleaners: combinedCleaners,
      errorHandler: hooks?.error,
    });
  } else {
    performToUse = createPerform(trigger.perform, {
      inputCleaners: triggerInputCleaners,
      errorHandler: hooks?.error,
    });
  }

  const result: ServerTrigger<
    TInputs,
    TActionInputs,
    TConfigVars,
    TPayload,
    TAllowsBranching,
    TResult
  > & {
    pollAction?: PollingTriggerDefinition["pollAction"];
    triggerType?: string;
  } = {
    // `batchConfig` / `triggerResolver` / `onDeployResolver` are author-only inputs; the
    // wire carries the serialized resolver behavior plus the single batch size instead.
    ...omit(trigger, ["batchConfig", "triggerResolver", "onDeployResolver"]),
    key: triggerKey,
    inputs: convertedTriggerInputs.concat(convertedActionInputs),
    perform: performToUse,
    scheduleSupport,
    synchronousResponseSupport:
      "synchronousResponseSupport" in trigger
        ? trigger.synchronousResponseSupport
        : scheduleSupport === "invalid"
          ? "valid"
          : "invalid",
    triggerResolverSupport,
    // The single shared default batch size → the one wire field the platform reads.
    ...buildBatchDefaultField(
      trigger.display.label,
      triggerResolverSupport,
      !!onDeployResolver?.resolveItems,
      batchConfig,
    ),
    ...buildTriggerResolverFields(triggerResolver),
    ...buildOnDeployResolverFields(onDeployResolver),
    ...(isPollingTriggerDefinition(trigger) ? { isPollingTrigger: true } : {}),
  };

  if (onInstanceDeploy) {
    result.onInstanceDeploy = createPerform(onInstanceDeploy, {
      inputCleaners: triggerInputCleaners,
      errorHandler: hooks?.error,
    });
    result.hasOnInstanceDeploy = true;
  }

  if (onDeployPerform) {
    result.onDeployPerform = createPerform(onDeployPerform, {
      inputCleaners: triggerInputCleaners,
      errorHandler: hooks?.error,
    });
    result.hasOnDeployPerform = true;
  }

  if (onInstanceDelete) {
    result.onInstanceDelete = createPerform(onInstanceDelete, {
      inputCleaners: triggerInputCleaners,
      errorHandler: hooks?.error,
    });
    result.hasOnInstanceDelete = true;
  }
  if (webhookLifecycleHandlers) {
    result.webhookCreate = createPerform(webhookLifecycleHandlers.create, {
      inputCleaners: triggerInputCleaners,
      errorHandler: hooks?.error,
    });
    result.webhookDelete = createPerform(webhookLifecycleHandlers.delete, {
      inputCleaners: triggerInputCleaners,
      errorHandler: hooks?.error,
    });
    result.hasWebhookCreateFunction = true;
    result.hasWebhookDeleteFunction = true;
  }

  const { pollAction, triggerType, webhookLifecycleHandlers: _, ...resultTrigger } = result;

  return resultTrigger;
};

const convertDataSource = (
  dataSourceKey: string,
  {
    inputs = {},
    perform,
    ...dataSource
  }: DataSourceDefinition<Inputs, ConfigVarResultCollection, any>,
  hooks?: ComponentHooks,
): ServerDataSource => {
  const convertedInputs = Object.entries(inputs).map(([key, value]) => convertInput(key, value));
  const inputCleaners = Object.entries(inputs).reduce<InputCleaners>(
    (result, [key, value]) => ({ ...result, [key]: cleanerFor(value) }),
    {},
  );

  return {
    ...dataSource,
    key: dataSourceKey,
    inputs: convertedInputs,
    perform: createPerform(perform, {
      inputCleaners,
      errorHandler: hooks?.error,
    }),
  };
};

export const convertConnection = ({
  inputs = {},
  ...connection
}: ConnectionDefinition): ServerConnection => {
  const {
    display: { label, icons, description: comments },
    ...remaining
  } = connection;

  const convertedInputs = Object.entries(inputs).map(([key, value]) => {
    if ("templateValue" in value) {
      return convertTemplateInput(key, value as ConnectionTemplateInputField, inputs);
    }

    return convertInput(key, value);
  });

  return {
    ...remaining,
    label,
    comments,
    iconPath: icons?.oauth2ConnectionIconPath,
    avatarIconPath: icons?.avatarPath,
    inputs: convertedInputs,
  };
};

export const convertComponent = <
  TPublic extends boolean,
  TKey extends string,
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
>({
  connections = [],
  actions = {},
  triggers = {},
  dataSources = {},
  hooks,
  ...definition
}: ComponentDefinition<TPublic, TKey>): ServerComponent<
  TInputs,
  TActionInputs,
  TConfigVars,
  TPayload,
  TAllowsBranching,
  TResult
> => {
  const convertedActions = Object.entries(actions).reduce(
    (result, [actionKey, action]) => ({
      ...result,
      [actionKey]: convertAction(actionKey, action, hooks),
    }),
    {},
  );

  const convertedTriggers = Object.entries(triggers).reduce(
    (result, [triggerKey, trigger]) => ({
      ...result,
      [triggerKey]: convertTrigger(triggerKey, trigger, hooks),
    }),
    {},
  );

  const convertedDataSources = Object.entries(dataSources).reduce(
    (result, [dataSourceKey, dataSource]) => ({
      ...result,
      [dataSourceKey]: convertDataSource(dataSourceKey, dataSource, hooks),
    }),
    {},
  );

  return {
    ...definition,
    connections: connections.map(convertConnection),
    actions: convertedActions,
    triggers: convertedTriggers,
    dataSources: convertedDataSources,
  };
};
