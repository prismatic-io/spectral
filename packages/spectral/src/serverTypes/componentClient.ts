import type { ActionDefinition } from "../types/ActionDefinition";
import type { ComponentClientActionInputParameters } from "../types/ActionInputParameters";
import type { ActionContext } from "../types/ActionPerformFunction";
import type {
  ComponentClientIdentity,
  ComponentClientReference,
  ComponentClientReferenceValues,
} from "../types/ComponentClient";
import type { ComponentDefinition } from "../types/ComponentDefinition";
import type {
  CollectionType,
  ComponentClientConnectionConfigVar,
  ComponentClientDataSourceConfigVar,
  ConfigVarVisibility,
  DataSourceReset,
  OnPremiseConnectionConfigTypeEnum,
} from "../types/ConfigVars";
import type { ConnectionDefinition, OAuth2Config } from "../types/ConnectionDefinition";
import type { DataSourceDefinition } from "../types/DataSourceDefinition";
import type { DataSourceType } from "../types/DataSourceResult";
import type { Inputs } from "../types/Inputs";
import type { ValidationMode } from "../types/jsonforms/ValidationMode";
import { requireContext } from "./asyncContext";
import { createDebugContext } from "./context";
import { convertInputValue } from "./convertIntegration";

type AnyActionDefinition = ActionDefinition<any, any, any, any>;
type AnyDataSourceDefinition = DataSourceDefinition<any, any, any>;

type ComponentClientInvokeFunction = (
  ref: { component: ComponentClientIdentity; key: string },
  context: ActionContext,
  values: Record<string, unknown>,
) => Promise<unknown>;

/**
 * The shape a client is built from at runtime: a component's keys and inputs, with no
 * implementation. A component definition satisfies it directly; an npm package that must not
 * ship its implementation generates one from `component(...).definition` at build time and
 * types the client from the definition (`componentClient<typeof built.definition>(descriptor)`).
 *
 * Inputs are typed loosely on purpose: only each input's `collection` and `default` are read.
 */
export interface ComponentClientDescriptor {
  key: string;
  public?: boolean;
  actions?: Record<string, { inputs: Record<string, object> }>;
  triggers?: Record<string, { inputs: Record<string, object> }>;
  dataSources?: Record<string, { inputs: Record<string, object>; dataSourceType: DataSourceType }>;
  connections?: Array<{ key: string; inputs: Record<string, object> }>;
}

type RequiredInputKeys<TInputs extends Inputs> = {
  [K in keyof TInputs]: TInputs[K] extends { required: true }
    ? TInputs[K] extends { default: unknown }
      ? never
      : K
    : never;
}[keyof TInputs];

type ClientActionArguments<TInputs extends Inputs> = [RequiredInputKeys<TInputs>] extends [never]
  ? [values?: ComponentClientActionInputParameters<TInputs>]
  : [values: ComponentClientActionInputParameters<TInputs>];

export type ComponentClientAction<TAction> =
  TAction extends ActionDefinition<infer TInputs, any, any, any>
    ? (...args: ClientActionArguments<TInputs>) => ReturnType<TAction["perform"]>
    : never;

type DefinitionInputs<TDefinition> = TDefinition extends {
  inputs: infer TInputs extends Record<string, unknown>;
}
  ? TInputs
  : Inputs;

export type ComponentClientTrigger<TTrigger> = (
  values?: ComponentClientReferenceValues<DefinitionInputs<TTrigger>, "trigger">,
) => ComponentClientReference<DefinitionInputs<TTrigger>, "trigger">;

type DataSourceConfig<TDataSource> = {
  stableKey: string;
  description?: string;
  values?: ComponentClientReferenceValues<DefinitionInputs<TDataSource>, "dataSource">;
  collectionType?: "valuelist" | "keyvaluelist";
  validationMode?: ValidationMode;
  dataSourceReset?: Omit<DataSourceReset, "dependencies">;
} & ConfigVarVisibility;

export type ComponentClientDataSource<TDataSource> = (
  configVar: DataSourceConfig<TDataSource>,
) => ComponentClientDataSourceConfigVar;

type ConnectionConfig<TConnection> = {
  stableKey: string;
  description?: string;
  values?: ComponentClientReferenceValues<DefinitionInputs<TConnection>, "connection">;
  template?: string;
  onPremiseConnectionConfig?: OnPremiseConnectionConfigTypeEnum;
  oauth2Config?: OAuth2Config;
} & ConfigVarVisibility;

export type ComponentClientConnection<TConnection> = (
  configVar: ConnectionConfig<TConnection>,
) => ComponentClientConnectionConfigVar;

export type ComponentClient<TDefinition extends ComponentDefinition<boolean, string>> = {
  readonly key: TDefinition["key"];
  readonly actions: {
    [K in keyof NonNullable<TDefinition["actions"]>]: ComponentClientAction<
      NonNullable<TDefinition["actions"]>[K]
    >;
  };
  readonly triggers: {
    [K in keyof NonNullable<TDefinition["triggers"]>]: ComponentClientTrigger<
      NonNullable<TDefinition["triggers"]>[K]
    >;
  };
  readonly dataSources: {
    [K in keyof NonNullable<TDefinition["dataSources"]>]: ComponentClientDataSource<
      NonNullable<TDefinition["dataSources"]>[K]
    >;
  };
  readonly connections: {
    [TConnection in NonNullable<
      TDefinition["connections"]
    >[number] as TConnection["key"]]: ComponentClientConnection<TConnection>;
  };
};

const componentIdentity = (
  definition: Pick<ComponentClientDescriptor, "key" | "public">,
): ComponentClientIdentity => ({
  key: definition.key,
  isPublic: Boolean(definition.public),
});

const memberReference = <
  TInputs extends Record<string, unknown>,
  TKind extends ComponentClientReference["kind"],
>(
  definition: Pick<ComponentClientDescriptor, "key" | "public">,
  kind: TKind,
  key: string,
  inputs: TInputs,
  values: ComponentClientReferenceValues<TInputs, TKind>,
): ComponentClientReference<TInputs, TKind> => ({
  __componentClientReference: true,
  kind,
  component: componentIdentity(definition),
  key,
  inputs,
  values,
});

const prepareValues = (
  inputs: Record<string, object>,
  values: Record<string, unknown>,
): Record<string, unknown> =>
  Object.entries(inputs).reduce<Record<string, unknown>>((result, [key, input]) => {
    const defaultValue = "default" in input ? input.default : undefined;
    const collection =
      "collection" in input ? (input.collection as CollectionType | undefined) : undefined;
    result[key] = convertInputValue(values[key] ?? defaultValue, collection);
    return result;
  }, {});

const createClientAction =
  (
    definition: Pick<ComponentClientDescriptor, "key" | "public">,
    actionKey: string,
    action: { inputs: Record<string, object> },
  ) =>
  async (values: Record<string, unknown> = {}) => {
    const context = requireContext();
    const internalComponents = (
      context as unknown as { _components?: { invoke?: ComponentClientInvokeFunction } }
    )._components;
    if (!internalComponents?.invoke) {
      throw new Error(
        `Component action ${definition.key}.${actionKey} cannot be invoked outside a Prismatic execution.`,
      );
    }
    return internalComponents.invoke(
      { component: componentIdentity(definition), key: actionKey },
      { ...context, debug: createDebugContext(context as never) },
      prepareValues(action.inputs, values),
    );
  };

/**
 * Creates a typed npm client whose members reference the published platform component.
 *
 * Pass the definition (`componentClient(built.definition)`) to infer the client's types from
 * it, or a generated shape-only descriptor with the definition's type supplied explicitly
 * (`componentClient<typeof built.definition>(descriptor)`) so the npm package ships no
 * implementation.
 */
export function componentClient<const TDefinition extends ComponentDefinition<boolean, string>>(
  definition: TDefinition,
): ComponentClient<TDefinition>;
export function componentClient<TDefinition extends ComponentDefinition<boolean, string>>(
  descriptor: ComponentClientDescriptor,
): ComponentClient<TDefinition>;
export function componentClient(
  definition: ComponentDefinition<boolean, string> | ComponentClientDescriptor,
): ComponentClient<ComponentDefinition<boolean, string>> {
  // A converted component's members carry `inputs` as the platform's positional array; a client
  // built from one would enumerate those as "0", "1" and drop every value the caller passes.
  // Only the definition (or a descriptor generated from it) keeps inputs keyed.
  const members = [
    ...Object.values(definition.actions ?? {}),
    ...Object.values(definition.triggers ?? {}),
    ...Object.values(definition.dataSources ?? {}),
    ...(definition.connections ?? []),
  ];
  if (members.some((member) => !member.inputs || Array.isArray(member.inputs))) {
    throw new Error(
      "componentClient() was given a converted component rather than its definition. Pass `component(...).definition`, or a descriptor generated from it.",
    );
  }

  const actions = Object.fromEntries(
    Object.entries(definition.actions ?? {}).map(([key, action]) => [
      key,
      createClientAction(definition, key, action),
    ]),
  );
  const triggers = Object.fromEntries(
    Object.entries(definition.triggers ?? {}).map(([key, trigger]) => [
      key,
      (values = {}) => memberReference(definition, "trigger", key, trigger.inputs, values),
    ]),
  );
  const dataSources = Object.fromEntries(
    Object.entries(definition.dataSources ?? {}).map(([key, dataSource]) => [
      key,
      ({ values = {}, ...configVar }: DataSourceConfig<AnyDataSourceDefinition>) => ({
        ...configVar,
        __componentClientConfigVar: true as const,
        dataSource: {
          ...memberReference(definition, "dataSource", key, dataSource.inputs, values),
          dataSourceType: dataSource.dataSourceType as DataSourceType,
        },
      }),
    ]),
  );
  const connections = Object.fromEntries(
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
          ...memberReference(definition, "connection", connection.key, connection.inputs, values),
          template,
          onPremiseConnectionConfig,
        },
      }),
    ]),
  );

  return {
    key: definition.key,
    actions,
    triggers,
    dataSources,
    connections,
  } as ComponentClient<ComponentDefinition<boolean, string>>;
}
