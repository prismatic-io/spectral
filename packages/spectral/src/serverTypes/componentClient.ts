import type {
  BundledDataSourceConfigVar,
  BundledTriggerReference,
  ComponentClientConnectionConfigVar,
  ConfigVarExpression,
  ConfigVarVisibility,
  OnPremiseConnectionConfigTypeEnum,
  TemplateExpression,
  ValueExpression,
} from "../types";
import type { ActionDefinition } from "../types/ActionDefinition";
import type { CallableActionInputParameters, InputValue } from "../types/ActionInputParameters";
import type {
  ComponentClientConnectionValues,
  ComponentClientIdentity,
  ComponentClientReference,
} from "../types/ComponentClient";
import type { ComponentDefinition } from "../types/ComponentDefinition";
import type { ConnectionDefinition, OAuth2Config } from "../types/ConnectionDefinition";
import type { Inputs } from "../types/Inputs";
import type { AnyDataSource, AnyTrigger, Component } from ".";
import { createBundledAction } from "./bundledAction";
import { createDataSourceConfigVar, type DataSourceConfigVarOptions } from "./bundledDataSource";
import { createTriggerReference } from "./bundledTrigger";

/** What `component()` returns: the converted component the platform publishes and runs,
 * carrying the definition it was built from. */
export type BuiltComponent<
  TDefinition extends ComponentDefinition<boolean, string> = ComponentDefinition<boolean, string>,
> = Component & { readonly definition: TDefinition };

type RequiredInputKeys<TInputs extends Inputs> = {
  [K in keyof TInputs]: TInputs[K] extends { required: true }
    ? TInputs[K] extends { default: unknown }
      ? never
      : K
    : never;
}[keyof TInputs];

type ActionArguments<TInputs extends Inputs> = [RequiredInputKeys<TInputs>] extends [never]
  ? [values?: CallableActionInputParameters<TInputs>]
  : [values: CallableActionInputParameters<TInputs>];

/** A bundled action, callable with just its input values; runs in the integration's process. */
export type ComponentClientAction<TAction> =
  TAction extends ActionDefinition<infer TInputs, any, any, any>
    ? (...args: ActionArguments<TInputs>) => ReturnType<TAction["perform"]>
    : never;

type DefinitionInputs<TDefinition> = TDefinition extends {
  inputs: infer TInputs extends Record<string, unknown>;
}
  ? TInputs
  : Inputs;

type TriggerValues<TInputs extends Record<string, unknown>> = {
  [K in keyof TInputs]?: ValueExpression<InputValue<TInputs[K]>> | ConfigVarExpression;
};

type DataSourceValues<TInputs extends Record<string, unknown>> = {
  [K in keyof TInputs]?:
    | ValueExpression<InputValue<TInputs[K]>>
    | ConfigVarExpression
    | TemplateExpression;
};

/** A bundled trigger, usable as a flow's `onTrigger`; it runs on the integration's own wrapper
 * component. */
export type ComponentClientTrigger<TTrigger> = (
  values?: TriggerValues<DefinitionInputs<TTrigger>>,
) => BundledTriggerReference<AnyTrigger>;

/** A bundled data source, usable as a config var; it is hoisted onto the integration's own
 * wrapper component. */
export type ComponentClientDataSource<TDataSource> = (
  configVar: Omit<DataSourceConfigVarOptions, "values"> & {
    values?: DataSourceValues<DefinitionInputs<TDataSource>>;
  },
) => BundledDataSourceConfigVar;

type ConnectionConfig<TConnection> = {
  stableKey: string;
  description?: string;
  values?: ComponentClientConnectionValues<DefinitionInputs<TConnection>>;
  template?: string;
  onPremiseConnectionConfig?: OnPremiseConnectionConfigTypeEnum;
  oauth2Config?: OAuth2Config;
} & ConfigVarVisibility;

/** A connection on the published component, usable as a connection config var. Connections are
 * platform objects, so this is a reference the platform resolves, not a bundled copy. */
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
 * Creates the client an integration uses for a component bundled with it: actions run
 * in-process, triggers and data sources are hosted on the integration's own wrapper component,
 * and connections reference the published component so they stay shared with low-code and
 * other integrations. Takes the object `component()` returns.
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
  const dataSources = (built.dataSources ?? {}) as Record<string, AnyDataSource>;

  return {
    key: definition.key,
    actions: Object.fromEntries(
      Object.entries(built.actions).map(([key, action]) => [key, createBundledAction(action)]),
    ),
    triggers: Object.fromEntries(
      Object.entries((built.triggers ?? {}) as Record<string, AnyTrigger>).map(([key, trigger]) => [
        key,
        createTriggerReference(trigger, dataSources),
      ]),
    ),
    dataSources: Object.fromEntries(
      Object.entries(dataSources).map(([key, dataSource]) => [
        key,
        createDataSourceConfigVar(dataSource, dataSources),
      ]),
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
  } as ComponentClient<TBuilt["definition"]>;
};
