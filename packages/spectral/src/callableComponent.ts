import cloneDeep from "lodash/cloneDeep";
import {
  invokeWithContext,
  requireContext,
  requireDataSourceContext,
} from "./serverTypes/asyncContext";
import { cleanerFor } from "./serverTypes/convertComponent";
import { cleanParams } from "./serverTypes/perform";
import { createPollingState } from "./serverTypes/pollingState";
import {
  type ActionDefinition,
  type ComponentDefinition,
  type ComponentHooks,
  type ConditionalExpression,
  type Connection,
  type ConnectionDefinition,
  InputFieldDefaultMap,
  type InputFieldDefinition,
  type Inputs,
  isPollingTriggerDefinition,
  type JSONForm,
  type KeyValuePair,
  type ObjectFieldMap,
  type ObjectSelection,
  type TriggerPayload,
} from "./types";

export type AuthoringDefinition = Pick<
  ComponentDefinition<boolean, string>,
  "actions" | "triggers" | "dataSources" | "connections" | "hooks"
>;

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

type CallableTrigger<TTrigger> = {
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

export type CallableComponent<TDefinition extends AuthoringDefinition> = {
  actions: {
    [K in keyof TDefinition["actions"]]: TDefinition["actions"][K] extends infer TAction extends
      ActionDefinition<any, any, boolean, any>
      ? (...args: InputArguments<TAction["inputs"]>) => ReturnType<TAction["perform"]>
      : never;
  };
  dataSources: {
    [K in keyof TDefinition["dataSources"]]: TDefinition["dataSources"][K] extends {
      inputs: infer TInputs extends Inputs;
      perform: infer TPerform extends (...args: any[]) => any;
    }
      ? (...args: InputArguments<TInputs>) => ReturnType<TPerform>
      : never;
  };
  triggers: { [K in keyof TDefinition["triggers"]]: CallableTrigger<TDefinition["triggers"][K]> };
  connections: TDefinition extends {
    connections: infer TConnections extends ConnectionDefinition[];
  }
    ? { [TConnection in TConnections[number] as TConnection["key"]]: TConnection }
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

  // An uncleaned boolean's authoring contract is its serialized string value. Accept
  // native booleans at the call site without passing a boolean to a string-typed perform.
  // Explicit cleaners still receive the original value and decide how to transform it.
  if (input.type === "boolean" && !input.clean) {
    const serialize = (entry: unknown) => (typeof entry === "boolean" ? String(entry) : entry);
    if (input.collection === "valuelist") {
      return Array.isArray(value) ? value.map(serialize) : value;
    }
    if (input.collection === "keyvaluelist") {
      return Array.isArray(value)
        ? value.map((entry) =>
            isRecord(entry) && "value" in entry
              ? { ...entry, value: serialize(entry.value) }
              : entry,
          )
        : value;
    }
    return serialize(value);
  }

  if (input.type === "structuredObject") {
    const prepareRecord = (entry: unknown) =>
      isRecord(entry) ? prepareInputs(input.inputs, entry) : entry;
    if (input.collection === "valuelist") {
      return Array.isArray(value) ? value.map(prepareRecord) : value;
    }
    if (input.collection === "keyvaluelist") {
      return Array.isArray(value)
        ? value.map((entry) =>
            isRecord(entry) && "value" in entry
              ? { ...entry, value: prepareRecord(entry.value) }
              : entry,
          )
        : value;
    }
    return prepareRecord(value === undefined ? {} : value);
  }

  if (input.type === "dynamicObject" && isRecord(value)) {
    const configuration =
      typeof value.configuration === "string"
        ? input.configurations[value.configuration]
        : undefined;
    if (configuration && isRecord(value.values)) {
      return { ...value, values: prepareInputs(configuration.inputs, value.values) };
    }
  }
  return value;
};

const prepareInputs = (
  inputs: Inputs,
  supplied: Record<string, unknown>,
): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(inputs).map(([key, definition]) => [
      key,
      prepareValue(definition, supplied[key]),
    ]),
  );
};

/** Build a cleaner once, then apply defaults and cleaning only after invocation. */
const prepareCall = (inputs: Inputs) => {
  const cleaners = Object.fromEntries(
    Object.entries(inputs).map(([key, input]) => [key, cleanerFor(input)]),
  );
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
  hooks?: ComponentHooks,
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
  return {
    ...trigger,
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
};

type AuthoringOf<TSource> =
  TSource extends AuthoringCarrier<infer TDefinition>
    ? TDefinition
    : TSource extends AuthoringDefinition
      ? TSource
      : never;

/**
 * Creates local calls from authored component entities. Triggers retain their metadata and
 * expose context-bound perform/lifecycle methods. Connections remain authoring definitions
 * for use with connectionConfigVar; reusable credentials are still managed by the platform.
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
    Object.fromEntries(
      Object.entries(entities).map(([key, entity]) => {
        const prepare = prepareCall(entity.inputs);
        return [
          key,
          async (values: Record<string, unknown> = {}) => {
            const context = getContext();
            return withErrorHook(definition.hooks, () =>
              entity.perform(context as any, prepare(values)),
            );
          },
        ];
      }),
    );
  const connections: Record<string, ConnectionDefinition> = {};
  for (const connection of definition.connections ?? []) {
    if (Object.hasOwn(connections, connection.key))
      throw new Error(`Duplicate connection key: ${connection.key}`);
    Object.defineProperty(connections, connection.key, { value: connection, enumerable: true });
  }
  // Object.fromEntries erases keys and per-entity signatures; each wrapper preserves them.
  return {
    actions: calls(definition.actions ?? {}, requireContext),
    dataSources: calls(definition.dataSources ?? {}, requireDataSourceContext),
    triggers: Object.fromEntries(
      Object.entries(definition.triggers ?? {}).map(([key, trigger]) => [
        key,
        callableTrigger(trigger, definition.hooks),
      ]),
    ),
    connections,
  } as unknown as CallableComponent<AuthoringOf<TSource>>;
};
