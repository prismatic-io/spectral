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
import { merge, omit } from "lodash";
import {
  isPollingTriggerDefinition,
  isPollingTriggerCustomDefinition,
  isPollingTriggerDefaultDefinition,
  PollingActionDefinition,
  PollingTriggerDefinition,
} from "../types/PollingTriggerDefinition";
import { input, util } from "..";

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
  trigger:
    | TriggerDefinition<Inputs, any, boolean, any>
    | PollingTriggerDefinition<Inputs, any, any, any, PollingActionDefinition<Inputs, any, any>>,
  hooks?: ComponentHooks,
): ServerTrigger => {
  const { inputs = {}, onInstanceDeploy, onInstanceDelete } = trigger;
  const isPollingTrigger = isPollingTriggerDefinition(trigger);

  if (isPollingTrigger && trigger.pollAction.firstStartingValueInputType) {
    const startingInputType = trigger.pollAction.firstStartingValueInputType;
    inputs.__prismatic_first_starting_value = input({
      label: "First starting value",
      comments: `The ${startingInputType} that this flow will begin polling with. Once the flow has run or been tested, this value will be ignored in favor of the most recently polled ${startingInputType} value.`,
      type: "string",
      clean: startingInputType === "date" ? util.types.toDate : util.types.toNumber,
    });
  }

  const triggerInputKeys = Object.keys(inputs);
  const convertedTriggerInputs = Object.entries(inputs).map(([key, value]) => {
    return convertInput(key, value);
  });

  const triggerInputCleaners = Object.entries(inputs).reduce<InputCleaners>(
    (result, [key, { clean }]) => ({ ...result, [key]: clean }),
    {},
  );

  let convertedActionInputs: Array<ServerInput> = [];

  const triggerPerform = trigger.perform
    ? createPerform(trigger.perform, {
        inputCleaners: triggerInputCleaners,
        errorHandler: hooks?.error,
      })
    : undefined;
  let performToUse: PerformFn;

  if (isPollingTrigger) {
    // Pull inputs up from the action and make them available on the trigger
    const { pollAction } = trigger;
    const { action, inputMap = {} } = pollAction;

    convertedActionInputs = Object.entries(action.inputs).reduce<Array<ServerInput>>(
      (accum, [key, value]) => {
        if (triggerInputKeys.includes(key)) {
          throw new Error(
            `Error: The pollingTrigger "${trigger.display.label}" was defined with an input with the key of ${key}. This key duplicates an keyed input needed on the associated "${action.display.label}" action. Please rename the trigger input with a different key.`,
          );
        }

        if (!(key in inputMap)) {
          // Only show the input at the top level if its value is not already populated by the inputMap
          accum.push(convertInput(key, value));
        }
        return accum;
      },
      [],
    );

    const actionInputCleaners = Object.entries(action.inputs).reduce<InputCleaners>(
      (result, [key, { clean }]) => ({ ...result, [key]: clean }),
      {},
    );

    performToUse = createPollingPerform(
      trigger,
      {
        inputCleaners: actionInputCleaners,
        errorHandler: hooks?.error,
      },
      triggerPerform,
    );
  } else if (triggerPerform) {
    performToUse = triggerPerform;
  } else {
    throw new Error(
      `Triggers require either a defined perform function or a pollAction. Trigger ${triggerKey} has defined neither.`,
    );
  }

  const result: ServerTrigger & {
    pollAction?: PollingTriggerDefinition<Inputs, any, any, any, any>["pollAction"];
  } = {
    ...trigger,
    key: triggerKey,
    inputs: convertedTriggerInputs.concat(convertedActionInputs),
    perform: performToUse,
    scheduleSupport: isPollingTrigger ? "required" : trigger?.scheduleSupport ?? "invalid",
    synchronousResponseSupport:
      "synchronousResponseSupport" in trigger ? trigger.synchronousResponseSupport : "valid",
  };

  if (onInstanceDeploy) {
    result.onInstanceDeploy = createPerform(onInstanceDeploy, {
      inputCleaners: triggerInputCleaners,
      errorHandler: hooks?.error,
    });
    result.hasOnInstanceDeploy = true;
  }

  if (onInstanceDelete) {
    result.onInstanceDelete = createPerform(onInstanceDelete, {
      inputCleaners: triggerInputCleaners,
      errorHandler: hooks?.error,
    });
    result.hasOnInstanceDelete = true;
  }

  const { pollAction, ...resultTrigger } = result;

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
