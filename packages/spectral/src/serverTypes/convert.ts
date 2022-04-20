import {
  ActionDefinition,
  InputFieldDefinition,
  ComponentDefinition,
  ConnectionDefinition,
  Inputs,
  TriggerDefinition,
  InputFieldDefaultMap,
  ComponentHooks,
} from "../types";
import {
  Component as ServerComponent,
  Connection as ServerConnection,
  Action as ServerAction,
  Trigger as ServerTrigger,
  Input as ServerInput,
} from ".";
import { InputCleaners, createPerform } from "./perform";

const convertInput = (
  key: string,
  {
    default: defaultValue,
    type,
    label,
    collection,
    ...rest
  }: InputFieldDefinition
): ServerInput => {
  const keyLabel =
    collection === "keyvaluelist" && typeof label === "object"
      ? label.key
      : undefined;

  return {
    ...rest,
    key,
    type,
    default: defaultValue ?? InputFieldDefaultMap[type],
    collection,
    label: typeof label === "string" ? label : label.value,
    keyLabel,
  };
};

const convertAction = (
  actionKey: string,
  { inputs = {}, perform, ...action }: ActionDefinition<Inputs>,
  hooks?: ComponentHooks
): ServerAction => {
  const convertedInputs = Object.entries(inputs).map(([key, value]) =>
    convertInput(key, value)
  );
  const inputCleaners = Object.entries(inputs).reduce<InputCleaners>(
    (result, [key, { clean }]) => ({ ...result, [key]: clean }),
    {}
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
  { inputs = {}, perform, ...trigger }: TriggerDefinition<Inputs>,
  hooks?: ComponentHooks
): ServerTrigger => {
  const convertedInputs = Object.entries(inputs).map(([key, value]) =>
    convertInput(key, value)
  );

  return {
    ...trigger,
    key: triggerKey,
    inputs: convertedInputs,
    perform: createPerform(perform, {
      inputCleaners: {},
      errorHandler: hooks?.error,
    }),
  };
};

const convertConnection = ({
  inputs = {},
  ...connection
}: ConnectionDefinition): ServerConnection => {
  const convertedInputs = Object.entries(inputs).map(([key, value]) =>
    convertInput(key, value)
  );

  return {
    ...connection,
    inputs: convertedInputs,
  };
};

export const convertComponent = <TPublic extends boolean>({
  connections = [],
  actions = {},
  triggers = {},
  hooks,
  ...definition
}: ComponentDefinition<TPublic>): ServerComponent => {
  const convertedActions = Object.entries(actions).reduce(
    (result, [actionKey, action]) => ({
      ...result,
      [actionKey]: convertAction(actionKey, action, hooks),
    }),
    {}
  );

  const convertedTriggers = Object.entries(triggers).reduce(
    (result, [triggerKey, trigger]) => ({
      ...result,
      [triggerKey]: convertTrigger(triggerKey, trigger, hooks),
    }),
    {}
  );

  return {
    ...definition,
    connections: connections.map(convertConnection),
    actions: convertedActions,
    triggers: convertedTriggers,
  };
};
