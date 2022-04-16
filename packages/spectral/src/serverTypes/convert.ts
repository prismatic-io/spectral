import { serializeError } from "serialize-error";
import { toJSON } from "../util";
import {
  ActionDefinition,
  InputFieldDefinition,
  ComponentDefinition,
  ConnectionDefinition,
  Inputs,
  TriggerDefinition,
  InputFieldDefaultMap,
  ErrorHandler,
  ComponentHooks,
} from "../types";
import {
  Component as ServerComponent,
  Connection as ServerConnection,
  Action as ServerAction,
  Trigger as ServerTrigger,
  Input as ServerInput,
} from ".";

const wrapPerform = <T>(
  fn: (...args: any[]) => Promise<T>,
  errorHandler: ErrorHandler
): ((...args: any[]) => Promise<T>) => {
  return async (...args: any[]): Promise<T> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw new Error(toJSON(serializeError(errorHandler(error))));
    }
  };
};

const convertInput = (
  key: string,
  {
    default: defaultValue,
    type,
    label,
    collection,
    ...rest
  }: InputFieldDefinition
): ServerInput => ({
  ...rest,
  key,
  type,
  default: defaultValue ?? InputFieldDefaultMap[type],
  collection,
  label: typeof label === "string" ? label : label.value,
  keyLabel:
    collection === "keyvaluelist" && typeof label === "object"
      ? label.key
      : undefined,
});

const convertAction = (
  actionKey: string,
  { inputs = {}, perform, ...action }: ActionDefinition<Inputs>,
  hooks?: ComponentHooks
): ServerAction => ({
  ...action,
  key: actionKey,
  perform: hooks?.error ? wrapPerform(perform, hooks.error) : perform,
  inputs: Object.entries(inputs).map(([key, value]) =>
    convertInput(key, value)
  ),
});

const convertTrigger = (
  triggerKey: string,
  { inputs = {}, perform, ...trigger }: TriggerDefinition<Inputs>,
  hooks?: ComponentHooks
): ServerTrigger => ({
  ...trigger,
  key: triggerKey,
  perform: hooks?.error ? wrapPerform(perform, hooks.error) : perform,
  inputs: Object.entries(inputs).map(([key, value]) =>
    convertInput(key, value)
  ),
});

const convertConnection = (
  connection: ConnectionDefinition
): ServerConnection => ({
  ...connection,
  inputs: Object.entries(connection.inputs ?? {}).map(([key, value]) =>
    convertInput(key, value)
  ),
});

export const convertComponent = <TPublic extends boolean>({
  connections = [],
  actions = {},
  triggers = {},
  hooks,
  ...definition
}: ComponentDefinition<TPublic>): ServerComponent => ({
  ...definition,
  connections: connections.map(convertConnection),
  actions: Object.entries(actions).reduce(
    (result, [actionKey, action]) => ({
      ...result,
      [actionKey]: convertAction(actionKey, action, hooks),
    }),
    {}
  ),
  triggers: Object.entries(triggers).reduce(
    (result, [triggerKey, trigger]) => ({
      ...result,
      [triggerKey]: convertTrigger(triggerKey, trigger, hooks),
    }),
    {}
  ),
});
