import cloneDeep from "lodash/cloneDeep";
import mapValues from "lodash/mapValues";
import {
  invokeWithContext,
  requireContext,
  requireDataSourceContext,
} from "./serverTypes/asyncContext";
import { type BoundTrigger, boundTriggerSymbol } from "./serverTypes/boundTrigger";
import {
  type BundledDataSource,
  bundledDataSourceSymbol,
  publishedConnectionSymbol,
} from "./serverTypes/callableConfigVar";
import {
  identifyDataSourceAlias,
  instrumentEntityCalls,
  instrumentTriggerCalls,
} from "./serverTypes/callableInstrumentation";
import { cleanerFor } from "./serverTypes/convertComponent";
import { cleanParams } from "./serverTypes/perform";
import { createPollingState } from "./serverTypes/pollingState";
import {
  type ActionContext,
  type ActionDefinition,
  type BaseConfigVar,
  type CollectionType,
  type ComponentDefinition,
  type ComponentHooks,
  type ConditionalExpression,
  type ConfigVarExpression,
  type ConfigVarVisibility,
  type Connection,
  type ConnectionConfigVar,
  type ConnectionDefinition,
  type DataSourceConfigVar,
  type DataSourceDefinition,
  type DataSourceType,
  InputFieldDefaultMap,
  type InputFieldDefinition,
  type Inputs,
  isPollingTriggerDefinition,
  type JSONForm,
  type KeyValuePair,
  type OAuth2Config,
  type OAuth2UrlOverrides,
  type ObjectFieldMap,
  type ObjectSelection,
  type OnPremiseConnectionConfigTypeEnum,
  type StandardConfigVar,
  type TriggerPayload,
} from "./types";

export type AuthoringDefinition = Pick<
  ComponentDefinition<boolean, string>,
  "actions" | "triggers" | "dataSources" | "connections" | "hooks"
> &
  Partial<Pick<ComponentDefinition<boolean, string>, "key" | "public">>;

/** Shared by separately bundled copies; never included in platform serialization. */
export const authoringSymbol: unique symbol = Symbol.for("@prismatic-io/spectral/authoring/v1");

export interface AuthoringCarrier<TDefinition extends AuthoringDefinition> {
  readonly [authoringSymbol]: TDefinition;
}

/** Retains the inferred authoring surface without changing the enumerable server surface. */
export const retainAuthoring = <TTarget extends object, TDefinition extends AuthoringDefinition>(
  target: TTarget,
  definition: TDefinition,
): TTarget & AuthoringCarrier<TDefinition> => {
  Object.defineProperty(target, authoringSymbol, { value: definition });
  return target as TTarget & AuthoringCarrier<TDefinition>;
};

type CollectionValue<TInput, TValue> = TInput extends { collection: "valuelist" }
  ? TValue[]
  : TInput extends { collection: "keyvaluelist" }
    ? KeyValuePair<TValue>[] | Record<string, TValue>
    : TValue;

/** Values supplied by a caller, before a component's cleaners transform them. */
type CallableInputValue<TInput> = TInput extends {
  type: "structuredObject";
  inputs: infer TInputs extends Inputs;
}
  ? CollectionValue<TInput, CallableInputs<TInputs>>
  : TInput extends {
        type: "dynamicObject";
        configurations: infer TConfigurations extends Record<string, { inputs: Inputs }>;
      }
    ? {
        [K in keyof TConfigurations]: {
          configuration: K;
          values: CallableInputs<TConfigurations[K]["inputs"]>;
        };
      }[keyof TConfigurations]
    : CollectionValue<
        TInput,
        TInput extends { type: "connection" }
          ? Connection
          : TInput extends { type: "number" | "float" }
            ? number | string
            : TInput extends { type: "boolean" }
              ? boolean | string
              : TInput extends { type: "conditional" }
                ? ConditionalExpression
                : TInput extends { type: "objectSelection" }
                  ? ObjectSelection
                  : TInput extends { type: "objectFieldMap" }
                    ? ObjectFieldMap
                    : TInput extends { type: "jsonForm" }
                      ? JSONForm
                      : TInput extends {
                            type: "data" | "dynamicObjectSelection" | "dynamicFieldSelection";
                          }
                        ? TInput extends { clean: (value: never) => unknown }
                          ? unknown
                          : string
                        : string
      >;

type RequiredInputKeys<TInputs extends Inputs> = {
  [K in keyof TInputs]: TInputs[K] extends { required: true }
    ? TInputs[K] extends { default: unknown }
      ? never
      : K
    : never;
}[keyof TInputs];

export type CallableInputs<TInputs extends Inputs> = {
  [K in RequiredInputKeys<TInputs>]: CallableInputValue<TInputs[K]>;
} & {
  [K in Exclude<keyof TInputs, RequiredInputKeys<TInputs>>]?: CallableInputValue<TInputs[K]>;
};

type InputArguments<TInputs extends Inputs> =
  RequiredInputKeys<TInputs> extends never
    ? [values?: CallableInputs<TInputs>]
    : [values: CallableInputs<TInputs>];

/** Config-var references resolve at invocation; literal values remain pre-clean values. */
type TriggerBindings<TInputs extends Inputs> = {
  [K in keyof CallableInputs<TInputs>]:
    | CallableInputs<TInputs>[K]
    | { value: CallableInputs<TInputs>[K] }
    | ConfigVarExpression;
};

type TriggerBindingArguments<TInputs extends Inputs> =
  RequiredInputKeys<TInputs> extends never
    ? [values?: TriggerBindings<TInputs>]
    : [values: TriggerBindings<TInputs>];

type TriggerFactory<TTrigger> = TTrigger extends {
  perform: (context: any, payload: infer TPayload, ...args: any[]) => infer TResult;
}
  ? (
      ...args: TriggerBindingArguments<
        EntityInputs<TTrigger> & PollInputs<TTrigger> & DeployInputs<TTrigger>
      >
    ) => (context: ActionContext, payload: TPayload) => TResult
  : never;

type EntityInputs<TEntity> = [TEntity] extends [never]
  ? Record<never, never>
  : TEntity extends { inputs?: infer TInputs extends Inputs }
    ? TInputs
    : Record<never, never>;

type PollInputs<TTrigger> = TTrigger extends { pollAction?: infer TAction }
  ? EntityInputs<NonNullable<TAction>>
  : Record<never, never>;

type DeployInputs<TTrigger> = TTrigger extends { onDeployResolver?: infer TResolver }
  ? EntityInputs<NonNullable<TResolver>>
  : Record<never, never>;

type WithoutContext<TFunction> = TFunction extends (
  context: any,
  ...args: infer TArgs
) => infer TResult
  ? (...args: TArgs) => TResult
  : TFunction;

type CallableResolver<TResolver> = {
  [K in keyof TResolver]: WithoutContext<TResolver[K]>;
};

type CallableEvents<TEvents, TInputs extends Inputs> = {
  [K in keyof TEvents]: TEvents[K] extends (...args: any[]) => infer TResult
    ? (...args: InputArguments<TInputs>) => TResult
    : TEvents[K];
};

type CallableTrigger<TTrigger> = TriggerFactory<TTrigger> & {
  [K in keyof TTrigger]: K extends "perform" | "onDeployPerform"
    ? TTrigger[K] extends infer TPerform
      ? TPerform extends (context: any, payload: infer TPayload, ...args: any[]) => infer TResult
        ? (
            payload: TPayload,
            ...args: InputArguments<
              EntityInputs<TTrigger> &
                (K extends "perform" ? PollInputs<TTrigger> : DeployInputs<TTrigger>)
            >
          ) => TResult
        : TPerform
      : never
    : K extends "onInstanceDeploy" | "onInstanceDelete"
      ? TTrigger[K] extends infer TEvent
        ? TEvent extends (...args: any[]) => infer TResult
          ? (...args: InputArguments<EntityInputs<TTrigger>>) => TResult
          : TEvent
        : never
      : K extends "triggerResolver" | "onDeployResolver"
        ? CallableResolver<TTrigger[K]>
        : K extends "webhookLifecycleHandlers"
          ? CallableEvents<TTrigger[K], EntityInputs<TTrigger>>
          : TTrigger[K];
};

type DataSourceOptions<TSource extends { dataSourceType: DataSourceType }> = Omit<
  Extract<DataSourceConfigVar, { dataSourceType: TSource["dataSourceType"] }>,
  "perform" | "dataSourceType"
> &
  Pick<Extract<StandardConfigVar, { dataType: TSource["dataSourceType"] }>, "defaultValue"> & {
    values: TriggerBindings<EntityInputs<TSource>>;
  };

/**
 * The config variable a callable data source returns. Its `collectionType` is the one the
 * caller gave, or absent, as a `dataSourceConfigVar` written out by hand would be: a
 * config variable's runtime value is a single value unless it declares a collection, so an
 * optional `collectionType` of any kind would type a picklist's value as every list form.
 */
type CallableDataSourceConfigVar<
  TSource extends { dataSourceType: DataSourceType },
  TCollection extends CollectionType | undefined,
> = (Extract<DataSourceConfigVar, { dataSourceType: TSource["dataSourceType"] }> extends infer T
  ? T extends unknown
    ? Omit<T, "collectionType">
    : never
  : never) & {
  dataSourceType: TSource["dataSourceType"];
} & ([TCollection] extends [CollectionType] ? { collectionType: TCollection } : unknown);

type CallableDataSource<TSource> = TSource extends {
  inputs: infer TInputs extends Inputs;
  dataSourceType: DataSourceType;
  perform: infer TPerform extends (...args: any[]) => any;
}
  ? {
      <TCollection extends CollectionType | undefined = undefined>(
        options: DataSourceOptions<TSource> & { collectionType?: TCollection },
      ): CallableDataSourceConfigVar<TSource, TCollection>;
      (...args: InputArguments<TInputs>): ReturnType<TPerform>;
      perform: (...args: InputArguments<TInputs>) => ReturnType<TPerform>;
    }
  : never;

type ConnectionOptions<TConnection> = BaseConfigVar & {
  /** Callable connections always reference their own package's artifact signature. */
  version?: never;
  values?: {
    [K in keyof EntityInputs<TConnection>]?: (
      | { value: CallableInputValue<EntityInputs<TConnection>[K]> }
      | ConfigVarExpression
      | ConfigVarVisibility
    ) &
      ConfigVarVisibility & { writeOnly?: true };
  };
  template?: string;
  onPremiseConnectionConfig?: OnPremiseConnectionConfigTypeEnum;
  oauth2Config?: OAuth2Config & OAuth2UrlOverrides;
};

export type CallableComponent<TDefinition extends AuthoringDefinition> = {
  actions: {
    [K in keyof TDefinition["actions"]]: TDefinition["actions"][K] extends infer TAction extends
      ActionDefinition<any, any, boolean, any>
      ? (...args: InputArguments<TAction["inputs"]>) => ReturnType<TAction["perform"]>
      : never;
  };
  dataSources: {
    [K in keyof TDefinition["dataSources"]]: CallableDataSource<TDefinition["dataSources"][K]>;
  };
  triggers: { [K in keyof TDefinition["triggers"]]: CallableTrigger<TDefinition["triggers"][K]> };
  connections: TDefinition extends {
    connections: infer TConnections extends ConnectionDefinition[];
  }
    ? {
        [TConnection in TConnections[number] as TConnection["key"]]: (
          options: ConnectionOptions<TConnection>,
        ) => ConnectionConfigVar;
      }
    : Record<never, never>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Default only undefined values: explicit null remains available to custom cleaners. */
const prepareValue = (input: InputFieldDefinition, supplied: unknown): unknown => {
  let value =
    supplied === undefined
      ? cloneDeep(
          ("default" in input ? input.default : undefined) ??
            ("collection" in input && input.collection ? [] : InputFieldDefaultMap[input.type]),
        )
      : supplied;

  if ("collection" in input && input.collection === "keyvaluelist" && isRecord(value)) {
    value = Object.entries(value).map(([key, value]) => ({ key, value }));
  }

  const prepare = (entry: unknown): unknown => {
    // Without a custom cleaner, authored boolean inputs are serialized strings.
    if (input.type === "boolean" && !input.clean) {
      return typeof entry === "boolean" ? String(entry) : entry;
    }
    if (input.type === "structuredObject") {
      return isRecord(entry) ? prepareInputs(input.inputs, entry) : entry;
    }
    if (input.type === "dynamicObject" && isRecord(entry)) {
      const configuration =
        typeof entry.configuration === "string"
          ? input.configurations[entry.configuration]
          : undefined;
      if (configuration && isRecord(entry.values)) {
        return { ...entry, values: prepareInputs(configuration.inputs, entry.values) };
      }
    }
    return entry;
  };
  if (input.type !== "structuredObject" && !(input.type === "boolean" && !input.clean)) {
    return prepare(value);
  }
  if ("collection" in input && input.collection) {
    if (!Array.isArray(value)) return value;
    if (input.collection === "valuelist") return value.map(prepare);
    if (input.collection === "keyvaluelist") {
      return value.map((entry) =>
        isRecord(entry) && "value" in entry ? { ...entry, value: prepare(entry.value) } : entry,
      );
    }
  }
  return prepare(input.type === "structuredObject" && value === undefined ? {} : value);
};

const prepareInputs = (inputs: Inputs, supplied: Record<string, unknown>) =>
  mapValues(inputs, (input, key) => prepareValue(input, supplied[key]));

/** Build a cleaner once, then apply defaults and cleaning only after invocation. */
const prepareCall = (inputs: Inputs) => {
  const cleaners = mapValues(inputs, cleanerFor);
  return (values: Record<string, unknown> = {}) =>
    cleanParams(prepareInputs(inputs, values), cleaners);
};

const withErrorHook = async <T>(
  hooks: ComponentHooks | undefined,
  invoke: () => T,
): Promise<Awaited<T>> => {
  try {
    return await invoke();
  } catch (error) {
    throw hooks?.error ? await hooks.error(error) : error;
  }
};

const callableTrigger = (
  trigger: NonNullable<AuthoringDefinition["triggers"]>[string],
  hooks: ComponentHooks | undefined,
  owner: object,
  key: string,
) => {
  const inputs = trigger.inputs ?? {};
  const batched = Boolean(trigger.batchConfig);
  const pollAction =
    isPollingTriggerDefinition(trigger) && "pollAction" in trigger ? trigger.pollAction : undefined;
  for (const key of Object.keys(pollAction?.inputs ?? {})) {
    if (Object.hasOwn(inputs, key))
      throw new Error(`Polling action input duplicates trigger input: ${key}`);
  }
  for (const key of Object.keys(trigger.onDeployResolver?.inputs ?? {})) {
    if (Object.hasOwn(inputs, key))
      throw new Error(`On-deploy input duplicates trigger input: ${key}`);
  }
  const prepare = prepareCall({ ...pollAction?.inputs, ...inputs });
  const prepareEvent = prepareCall(inputs);
  const prepareDeploy = prepareCall({ ...inputs, ...trigger.onDeployResolver?.inputs });
  const perform =
    (fn: typeof trigger.perform, prepareParams: ReturnType<typeof prepareCall>) =>
    async (payload: TriggerPayload, values: Record<string, unknown> = {}) => {
      const context = requireContext();
      return withErrorHook(hooks, () => {
        const params = prepareParams(values);
        const triggerContext = isPollingTriggerDefinition(trigger)
          ? {
              ...context,
              polling: {
                ...createPollingState(context),
                // These are already cleaned by the trigger boundary, just as on the platform.
                invokeAction: async (cleaned: Record<string, unknown>) => {
                  if (!pollAction) throw new Error("This polling trigger has no pollAction.");
                  return pollAction.perform(triggerContext, cleaned);
                },
              },
            }
          : batched
            ? { ...context, polling: createPollingState(context) }
            : context;
        return invokeWithContext(triggerContext as any, fn, payload, params);
      });
    };
  const event =
    (fn: (...args: any[]) => any) =>
    async (values: Record<string, unknown> = {}) => {
      const context = requireContext();
      return withErrorHook(hooks, () => fn(context, prepareEvent(values)));
    };
  const resolver = (definition: NonNullable<typeof trigger.triggerResolver>) => ({
    ...definition,
    ...(definition.resolveItems
      ? { resolveItems: (result: any) => definition.resolveItems?.(requireContext(), result) }
      : {}),
    ...(definition.getNextPaginationState
      ? {
          getNextPaginationState: (result: any) =>
            definition.getNextPaginationState?.(requireContext(), result),
        }
      : {}),
  });
  const calls = {
    perform: perform(trigger.perform, prepare),
    ...(trigger.onDeployPerform
      ? { onDeployPerform: perform(trigger.onDeployPerform, prepareDeploy) }
      : {}),
    ...(trigger.onInstanceDeploy ? { onInstanceDeploy: event(trigger.onInstanceDeploy) } : {}),
    ...(trigger.onInstanceDelete ? { onInstanceDelete: event(trigger.onInstanceDelete) } : {}),
    ...("webhookLifecycleHandlers" in trigger && trigger.webhookLifecycleHandlers
      ? {
          webhookLifecycleHandlers: {
            create: event(trigger.webhookLifecycleHandlers.create),
            delete: event(trigger.webhookLifecycleHandlers.delete),
          },
        }
      : {}),
    ...(trigger.triggerResolver ? { triggerResolver: resolver(trigger.triggerResolver) } : {}),
    ...(trigger.onDeployResolver ? { onDeployResolver: resolver(trigger.onDeployResolver) } : {}),
  };
  instrumentTriggerCalls(calls, owner, key, trigger.examplePayload);
  const factory = (bindings: Record<string, unknown> = {}) => {
    const resolve = (context: ActionContext, definitions: Inputs) =>
      Object.fromEntries(
        Object.keys(definitions).map((key) => {
          const binding = bindings[key];
          if (isRecord(binding) && Object.hasOwn(binding, "configVar")) {
            if (
              typeof binding.configVar !== "string" ||
              !Object.hasOwn(context.configVars, binding.configVar)
            ) {
              throw new Error(
                `Missing config variable for trigger input "${key}": ${String(binding.configVar)}`,
              );
            }
            return [key, context.configVars[binding.configVar]];
          }
          return [
            key,
            isRecord(binding) && Object.hasOwn(binding, "value") ? binding.value : binding,
          ];
        }),
      );
    const bindEvent =
      (fn: NonNullable<typeof calls.onInstanceDeploy>) => (context: ActionContext) =>
        invokeWithContext(context, (context) => fn(resolve(context, inputs)));
    const bound = (context: ActionContext, payload: TriggerPayload) =>
      invokeWithContext(context, (context) =>
        calls.perform(payload, resolve(context, { ...pollAction?.inputs, ...inputs })),
      );
    const onDeployPerform = calls.onDeployPerform;
    const metadata: BoundTrigger = {
      definition: trigger,
      bindings,
      ...(calls.onInstanceDeploy ? { onInstanceDeploy: bindEvent(calls.onInstanceDeploy) } : {}),
      ...(calls.onInstanceDelete ? { onInstanceDelete: bindEvent(calls.onInstanceDelete) } : {}),
      ...(calls.webhookLifecycleHandlers
        ? {
            webhookLifecycleHandlers: {
              create: bindEvent(calls.webhookLifecycleHandlers.create),
              delete: bindEvent(calls.webhookLifecycleHandlers.delete),
            },
          }
        : {}),
      ...(onDeployPerform
        ? {
            onDeployTrigger: (context: ActionContext, payload: TriggerPayload) =>
              invokeWithContext(context, (context) =>
                onDeployPerform(
                  payload,
                  resolve(context, { ...inputs, ...trigger.onDeployResolver?.inputs }),
                ),
              ),
          }
        : {}),
    };
    Object.defineProperty(bound, boundTriggerSymbol, { value: metadata });
    return bound;
  };
  return Object.assign(factory, trigger, calls);
};

type AuthoringOf<TSource> =
  TSource extends AuthoringCarrier<infer TDefinition>
    ? TDefinition
    : TSource extends AuthoringDefinition
      ? TSource
      : never;

/**
 * Creates local calls from authored component entities. Triggers retain their metadata and
 * expose context-bound perform/lifecycle methods. Connection factories reference published
 * components, while data-source factories build bundled configuration callbacks.
 * Prism resolves the reserved self signature to the packaged component artifact at publication.
 */
export const callableComponent = <
  TSource extends AuthoringCarrier<AuthoringDefinition> | AuthoringDefinition,
>(
  source: TSource,
): CallableComponent<AuthoringOf<TSource>> => {
  const definition: AuthoringDefinition =
    authoringSymbol in source ? source[authoringSymbol] : source;
  const entities = [
    ...Object.values(definition.actions ?? {}),
    ...Object.values(definition.dataSources ?? {}),
    ...Object.values(definition.triggers ?? {}),
  ];
  if (
    entities.some(
      (entity) => Array.isArray(entity.inputs) || typeof entity.perform !== "function",
    ) ||
    (definition.connections ?? []).some((connection) => Array.isArray(connection.inputs)) ||
    // An empty converted component is also not an authoring definition.
    (!(authoringSymbol in source) && "signature" in source)
  ) {
    throw new Error(
      "callableComponent requires authoring definitions or a component created with a supporting " +
        "version of Spectral. Pass the original component; spreading or serializing it loses authoring data.",
    );
  }
  const calls = (
    entities:
      | NonNullable<AuthoringDefinition["actions"]>
      | NonNullable<AuthoringDefinition["dataSources"]>,
    getContext: typeof requireContext | typeof requireDataSourceContext,
  ) =>
    mapValues(entities, (entity) => {
      const prepare = prepareCall(entity.inputs);
      return async (values: Record<string, unknown> = {}) => {
        const context = getContext();
        return withErrorHook(definition.hooks, () =>
          entity.perform(context as any, prepare(values)),
        );
      };
    });
  const connections = Object.fromEntries(
    (definition.connections ?? []).map((connection) => [
      connection.key,
      ({
        values = {},
        template,
        onPremiseConnectionConfig,
        ...options
      }: ConnectionOptions<typeof connection>) => {
        // Discard overrides supplied by callers that bypass the type restriction.
        delete options.version;
        if (!definition.key) throw new Error("Published connections require the component's key.");
        const reference = {
          component: definition.key,
          key: connection.key,
          values,
          template,
          onPremiseConnectionConfig,
          [publishedConnectionSymbol]: {
            component: {
              key: definition.key,
              isPublic: definition.public ?? false,
              signature: "__PRISMATIC_COMPONENT_SELF__",
            },
            inputs: connection.inputs,
          },
        };
        return { ...options, dataType: "connection", connection: reference };
      },
    ]),
  );
  if (Object.keys(connections).length !== (definition.connections ?? []).length)
    throw new Error("Duplicate connection key");

  const dataSourceCalls = instrumentEntityCalls(
    calls(definition.dataSources ?? {}, requireDataSourceContext),
    definition,
    definition.dataSources ?? {},
    "dataSources",
  );
  const configDataSource = (
    key: string,
    options: BaseConfigVar & { values: Record<string, unknown> },
    ancestors: string[] = [],
  ): DataSourceDefinition<Inputs, any, any> & { [bundledDataSourceSymbol]: BundledDataSource } => {
    if (ancestors.includes(key))
      throw new Error(`Circular detail data source: ${[...ancestors, key].join(" -> ")}`);
    const source = definition.dataSources?.[key];
    if (!source) throw new Error(`Unknown detail data source: ${key}`);
    const { values, ...config } = options;
    const { detailDataSource, ...entity } = source;
    return {
      ...entity,
      ...config,
      perform: async (context, params) => {
        const resolved = Object.fromEntries(
          Object.entries(values)
            .filter(([key]) => key in source.inputs)
            .map(([key, binding]) => {
              if (isRecord(binding) && "configVar" in binding) {
                const name = String(binding.configVar);
                if (!(name in context.configVars))
                  throw new Error(
                    `Missing config variable for data source input "${key}": ${name}`,
                  );
                return [key, context.configVars[name]];
              }
              return [key, isRecord(binding) && "value" in binding ? binding.value : binding];
            }),
        );
        return dataSourceCalls[key]({ ...resolved, ...params });
      },
      [bundledDataSourceSymbol]: {
        inputs: source.inputs,
        values,
        ...(detailDataSource
          ? { detail: configDataSource(detailDataSource, options, [...ancestors, key]) }
          : {}),
      },
    };
  };
  const dataSources = mapValues(dataSourceCalls, (perform, key) =>
    identifyDataSourceAlias(
      Object.assign(
        (...args: [values?: Record<string, unknown>]) => {
          const [values = {}] = args;
          return typeof values.stableKey === "string" && isRecord(values.values)
            ? configDataSource(key, {
                ...values,
                stableKey: values.stableKey,
                values: values.values,
              })
            : perform(...args);
        },
        { perform },
      ),
      perform,
    ),
  );
  // Runtime iteration erases per-entity signatures; each wrapper preserves them.
  return {
    actions: instrumentEntityCalls(
      calls(definition.actions ?? {}, requireContext),
      definition,
      definition.actions ?? {},
      "actions",
    ),
    dataSources,
    triggers: mapValues(definition.triggers, (trigger, key) =>
      callableTrigger(trigger, definition.hooks, definition, key),
    ),
    connections,
  } as unknown as CallableComponent<AuthoringOf<TSource>>;
};
