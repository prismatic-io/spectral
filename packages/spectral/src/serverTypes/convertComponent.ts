import {
  ActionDefinition,
  InputFieldDefinition,
  ComponentDefinition,
  ConnectionDefinition,
  Inputs,
  TriggerDefinition,
  InputFieldDefaultMap,
  ComponentHooks,
  DataSourceDefinition,
  ConfigVarResultCollection,
  OnPremConnectionInput,
} from "../types";
import {
  Component as ServerComponent,
  Connection as ServerConnection,
  Action as ServerAction,
  Trigger as ServerTrigger,
  Input as ServerInput,
  DataSource as ServerDataSource,
} from ".";
import { InputCleaners, PerformFn, createPerform, createPollingPerform } from "./perform";
import { omit } from "lodash";
import { PollingTriggerDefinition } from "../types/PollingTriggerDefinition";

export const convertInput = (
  key: string,
  {
    default: defaultValue,
    type,
    label,
    collection,
    ...rest
  }: InputFieldDefinition | OnPremConnectionInput,
): ServerInput => {
  const keyLabel =
    collection === "keyvaluelist" && typeof label === "object" ? label.key : undefined;

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
    onPremiseControlled: ("onPremControlled" in rest && rest.onPremControlled) || undefined,
  };
};

const convertAction = (
  actionKey: string,
  { inputs = {}, perform, ...action }: ActionDefinition<Inputs, any, boolean, any>,
  hooks?: ComponentHooks,
): ServerAction => {
  const convertedInputs = Object.entries(inputs).map(([key, value]) => convertInput(key, value));
  const inputCleaners = Object.entries(inputs).reduce<InputCleaners>(
    (result, [key, { clean }]) => ({ ...result, [key]: clean }),
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
  };
};

const convertTrigger = (
  triggerKey: string,
  {
    inputs = {},
    perform,
    onInstanceDeploy,
    onInstanceDelete,
    ...trigger
  }: TriggerDefinition<Inputs, any, boolean, any> | PollingTriggerDefinition<Inputs, any, any, any>,
  hooks?: ComponentHooks,
): ServerTrigger => {
  const convertedInputs = Object.entries(inputs).map(([key, value]) => convertInput(key, value));
  const inputCleaners = Object.entries(inputs).reduce<InputCleaners>(
    (result, [key, { clean }]) => ({ ...result, [key]: clean }),
    {},
  );
  const isPollingTrigger = "action" in trigger;
  let triggerPerform: PerformFn;

  if (isPollingTrigger) {
    triggerPerform = perform
      ? createPerform(perform, {
          inputCleaners,
          errorHandler: hooks?.error,
        })
      : createPollingPerform(trigger, {
          inputCleaners,
          errorHandler: hooks?.error,
        });
  } else if (perform) {
    triggerPerform = createPerform(perform, {
      inputCleaners,
      errorHandler: hooks?.error,
    });
  } else {
    throw new Error("No perform method was provided for this trigger.");
  }

  const result: ServerTrigger & { action?: ActionDefinition } = {
    ...trigger,
    key: triggerKey,
    inputs: convertedInputs,
    perform: triggerPerform,
    scheduleSupport: "action" in trigger ? "required" : trigger?.scheduleSupport ?? "invalid",
    synchronousResponseSupport:
      "synchronousResponseSupport" in trigger ? trigger.synchronousResponseSupport : "valid",
  };

  if (onInstanceDeploy) {
    result.onInstanceDeploy = createPerform(onInstanceDeploy, {
      inputCleaners,
      errorHandler: hooks?.error,
    });
    result.hasOnInstanceDeploy = true;
  }

  if (onInstanceDelete) {
    result.onInstanceDelete = createPerform(onInstanceDelete, {
      inputCleaners,
      errorHandler: hooks?.error,
    });
    result.hasOnInstanceDelete = true;
  }

  const { action, ...resultTrigger } = result;
  return {
    ...resultTrigger,
    allowsBranching: isPollingTrigger ? true : resultTrigger.allowsBranching,
    staticBranchNames: isPollingTrigger ? ["No Results", "Results"] : undefined,
  };
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
    (result, [key, { clean }]) => ({ ...result, [key]: clean }),
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

const convertConnection = ({
  inputs = {},
  ...connection
}: ConnectionDefinition): ServerConnection => {
  const convertedInputs = Object.entries(inputs).map(([key, value]) => convertInput(key, value));

  return {
    ...connection,
    inputs: convertedInputs,
  };
};

export const convertComponent = <TPublic extends boolean, TKey extends string>({
  connections = [],
  actions = {},
  triggers = {},
  dataSources = {},
  hooks,
  ...definition
}: ComponentDefinition<TPublic, TKey>): ServerComponent => {
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
