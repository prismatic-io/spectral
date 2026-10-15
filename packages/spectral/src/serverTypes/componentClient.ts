import cloneDeep from "lodash/cloneDeep";
import type {
  BundledDataSourceConfigVar,
  ComponentClientConnectionConfigVar,
  ConfigVarExpression,
  ConfigVarVisibility,
  OnPremiseConnectionConfigTypeEnum,
  TemplateExpression,
  ValueExpression,
} from "../types";
import type { ActionDefinition } from "../types/ActionDefinition";
import type { CallableActionInputParameters, InputValue } from "../types/ActionInputParameters";
import type { ActionContext } from "../types/ActionPerformFunction";
import type {
  ComponentClientConnectionValues,
  ComponentClientIdentity,
  ComponentClientReference,
} from "../types/ComponentClient";
import type { ComponentDefinition, ComponentHooks } from "../types/ComponentDefinition";
import type { ConnectionDefinition, OAuth2Config } from "../types/ConnectionDefinition";
import { InputFieldDefaultMap, type InputFieldDefinition, type Inputs } from "../types/Inputs";
import { isPollingTriggerDefinition } from "../types/PollingTriggerDefinition";
import type { TriggerPayload } from "../types/TriggerPayload";
import type { AnyDataSource, Component } from ".";
import { requireContext, requireDataSourceContext, runWithContext } from "./asyncContext";
import { type BoundTrigger, boundTriggerSymbol } from "./boundTrigger";
import { createBundledAction } from "./bundledAction";
import { createDataSourceConfigVar, type DataSourceConfigVarOptions } from "./bundledDataSource";
import { cleanerFor } from "./convertComponent";
import { cleanParams } from "./perform";
import { createPollingState } from "./pollingState";

/** What `component()` returns: the converted component the platform publishes and runs,
 * carrying the definition it was built from. */
export type BuiltComponent<
  TDefinition extends ComponentDefinition<boolean, string> = ComponentDefinition<boolean, string>,
> = Component & { readonly definition: TDefinition };

type AnyTriggerDefinition = NonNullable<ComponentDefinition<boolean, string>["triggers"]>[string];

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

type RequiredInputKeys<TInputs extends Inputs> = {
  [K in keyof TInputs]: TInputs[K] extends { required: true }
    ? TInputs[K] extends { default: unknown }
      ? never
      : K
    : never;
}[keyof TInputs];

type InputArguments<TInputs extends Inputs> = [RequiredInputKeys<TInputs>] extends [never]
  ? [values?: CallableActionInputParameters<TInputs>]
  : [values: CallableActionInputParameters<TInputs>];

/** A bundled action, callable with just its input values; runs in the integration's process. */
export type ComponentClientAction<TAction> =
  TAction extends ActionDefinition<infer TInputs, any, any, any>
    ? (...args: InputArguments<TInputs>) => ReturnType<TAction["perform"]>
    : never;

type DefinitionInputs<TDefinition> = TDefinition extends {
  inputs: infer TInputs extends Record<string, unknown>;
}
  ? TInputs
  : Inputs;

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

/** A flow-side binding for one trigger input: a pre-clean value, `{ value }` for a literal
 * object that itself has a `value` or `configVar` key, or a config var read at invocation. */
type TriggerBindings<TInputs extends Inputs> = {
  [K in keyof CallableActionInputParameters<TInputs>]:
    | CallableActionInputParameters<TInputs>[K]
    | { value: CallableActionInputParameters<TInputs>[K] }
    | ConfigVarExpression;
};

type TriggerBindingArguments<TInputs extends Inputs> = [RequiredInputKeys<TInputs>] extends [never]
  ? [values?: TriggerBindings<TInputs>]
  : [values: TriggerBindings<TInputs>];

/** `client.triggers.webhook({...})`: binds inputs and returns a trigger perform the flow uses as
 * its `onTrigger`. The flow's wrapper trigger runs it in-process. */
type TriggerFactory<TTrigger> = TTrigger extends {
  perform: (context: any, payload: infer TPayload, ...args: any[]) => infer TResult;
}
  ? (
      ...args: TriggerBindingArguments<
        EntityInputs<TTrigger> & PollInputs<TTrigger> & DeployInputs<TTrigger>
      >
    ) => (context: ActionContext, payload: TPayload) => TResult
  : never;

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

/** A bundled trigger: the binding factory, plus each of the trigger's own functions callable
 * in-process with just its input values. */
export type ComponentClientTrigger<TTrigger> = TriggerFactory<TTrigger> & {
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

type DataSourceValues<TInputs extends Record<string, unknown>> = {
  [K in keyof TInputs]?:
    | ValueExpression<InputValue<TInputs[K]>>
    | ConfigVarExpression
    | TemplateExpression;
};

/** A bundled data source: callable in-process from a flow or a configuration callback, and
 * `.configVar({...})` declares a config var backed by it, hosted on the integration's own
 * wrapper component. */
export type ComponentClientDataSource<TDataSource> = (TDataSource extends {
  inputs: infer TInputs extends Inputs;
  perform: infer TPerform extends (...args: any[]) => any;
}
  ? (...args: InputArguments<TInputs>) => ReturnType<TPerform>
  : never) & {
  configVar: (
    configVar: Omit<DataSourceConfigVarOptions, "values"> & {
      values?: DataSourceValues<DefinitionInputs<TDataSource>>;
    },
  ) => BundledDataSourceConfigVar;
};

type ConnectionConfig<TConnection> = {
  stableKey: string;
  description?: string;
  values?: ComponentClientConnectionValues<DefinitionInputs<TConnection>>;
  template?: string;
  onPremiseConnectionConfig?: OnPremiseConnectionConfigTypeEnum;
  oauth2Config?: OAuth2Config;
} & ConfigVarVisibility;

/** A connection on the published component, usable as a connection config var. Connections
 * are platform objects, so this is a reference the platform resolves, not a bundled copy. */
export type ComponentClientConnection<TConnection> = (
  configVar: ConnectionConfig<TConnection>,
) => ComponentClientConnectionConfigVar;

/** One of the definition's entity maps, or an empty map when the definition has none. */
type Entities<
  TDefinition,
  TKey extends "actions" | "triggers" | "dataSources",
> = TKey extends keyof TDefinition
  ? NonNullable<TDefinition[TKey & keyof TDefinition]>
  : Record<never, never>;

/** The definition's connections, as a union, or `never` when it declares none. */
type Connections<TDefinition> = "connections" extends keyof TDefinition
  ? NonNullable<TDefinition["connections" & keyof TDefinition]> extends ReadonlyArray<
      infer TConnection
    >
    ? TConnection
    : never
  : never;

export type ComponentClient<TDefinition extends ComponentDefinition<boolean, string>> = {
  readonly key: TDefinition["key"];
  readonly actions: {
    [K in keyof Entities<TDefinition, "actions">]: ComponentClientAction<
      Entities<TDefinition, "actions">[K]
    >;
  };
  readonly triggers: {
    [K in keyof Entities<TDefinition, "triggers">]: ComponentClientTrigger<
      Entities<TDefinition, "triggers">[K]
    >;
  };
  readonly dataSources: {
    [K in keyof Entities<TDefinition, "dataSources">]: ComponentClientDataSource<
      Entities<TDefinition, "dataSources">[K]
    >;
  };
  readonly connections: {
    [TConnection in Connections<TDefinition> as TConnection extends {
      key: infer TKey extends string;
    }
      ? TKey
      : never]: ComponentClientConnection<TConnection>;
  };
};

// ---------------------------------------------------------------------------------------------
// Call-time input preparation (defaults, then the component's own cleaners)
// ---------------------------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Defaults only an undefined value, so an explicit null still reaches a custom cleaner. */
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

  // An uncleaned boolean reaches `perform` as its serialized string on the platform. Accept a
  // native boolean at the call site without handing a boolean to a string-typed perform; an
  // explicit cleaner still receives the original value.
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

const prepareInputs = (inputs: Inputs, supplied: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(inputs).map(([key, definition]) => [
      key,
      prepareValue(definition, supplied[key]),
    ]),
  );

/** Builds the cleaners once; defaults and cleaning apply per call. */
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

// ---------------------------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------------------------

const callableTrigger = (trigger: AnyTriggerDefinition, hooks?: ComponentHooks) => {
  const inputs = trigger.inputs ?? {};
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
                // Already cleaned at the trigger boundary, as on the platform.
                invokeAction: async (cleaned: Record<string, unknown>) => {
                  if (!pollAction) throw new Error("This polling trigger has no pollAction.");
                  return pollAction.perform(triggerContext, cleaned);
                },
              },
            }
          : context;
        return runWithContext(triggerContext, () => fn(triggerContext as any, payload, params));
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

  /** Binds inputs for a flow: config var bindings resolve from each invocation's context. */
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
        runWithContext(context, () => fn(resolve(context, inputs)));
    const bound = (context: ActionContext, payload: TriggerPayload) =>
      runWithContext(context, () =>
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
              runWithContext(context, () =>
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

// ---------------------------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------------------------

const connectionReference = (
  component: ComponentClientIdentity,
  connection: ConnectionDefinition,
  values: Record<string, unknown>,
): ComponentClientReference => ({
  __componentClientReference: true,
  kind: "connection",
  component,
  key: connection.key,
  inputs: connection.inputs as Inputs,
  values: values as ComponentClientConnectionValues<Inputs>,
});

/**
 * Creates the client an integration uses for a component bundled with it. Actions run
 * in-process; a trigger binds its inputs and becomes the flow's `onTrigger`, run by the
 * integration's own wrapper trigger with the component's lifecycle, polling and batching
 * behavior carried over; a data source is callable from a flow or a configuration callback and
 * can back a config var; a connection references the published component, so it stays shared
 * with low-code and other integrations. Takes the object `component()` returns.
 */
export const componentClient = <TBuilt extends BuiltComponent>(
  built: TBuilt,
): ComponentClient<TBuilt["definition"]> => {
  if (!("definition" in built) || !built.definition) {
    throw new Error(
      "componentClient() takes the object component() returns. Spreading or serializing it loses the definition it carries.",
    );
  }
  const { definition } = built;
  const identity: ComponentClientIdentity = {
    key: definition.key,
    isPublic: Boolean(definition.public),
  };
  const convertedDataSources = (built.dataSources ?? {}) as Record<string, AnyDataSource>;

  return {
    key: definition.key,
    actions: Object.fromEntries(
      Object.entries(built.actions).map(([key, action]) => [key, createBundledAction(action)]),
    ),
    triggers: Object.fromEntries(
      Object.entries(definition.triggers ?? {}).map(([key, trigger]) => [
        key,
        callableTrigger(trigger as AnyTriggerDefinition, definition.hooks),
      ]),
    ),
    dataSources: Object.fromEntries(
      Object.entries(definition.dataSources ?? {}).map(([key, dataSource]) => {
        const prepare = prepareCall(dataSource.inputs);
        const call = async (values: Record<string, unknown> = {}) => {
          const context = requireDataSourceContext();
          return withErrorHook(definition.hooks, () =>
            dataSource.perform(context as never, prepare(values) as never),
          );
        };
        return [
          key,
          Object.assign(call, {
            configVar: createDataSourceConfigVar(convertedDataSources[key], convertedDataSources),
          }),
        ];
      }),
    ),
    connections: Object.fromEntries(
      (definition.connections ?? []).map((connection) => [
        connection.key,
        ({
          values = {},
          template,
          onPremiseConnectionConfig,
          ...configVar
        }: ConnectionConfig<ConnectionDefinition>) => ({
          ...configVar,
          __componentClientConfigVar: true as const,
          dataType: "connection" as const,
          connection: {
            ...connectionReference(identity, connection, values),
            template,
            onPremiseConnectionConfig,
          },
        }),
      ]),
    ),
  } as unknown as ComponentClient<TBuilt["definition"]>;
};
