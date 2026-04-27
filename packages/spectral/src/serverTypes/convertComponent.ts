import omit from "lodash/omit";
import {
  ActionDefinition,
  ComponentDefinition,
  ComponentHooks,
  ConfigVarResultCollection,
  ConnectionDefinition,
  ConnectionInput,
  ConnectionTemplateInputField,
  DataSourceDefinition,
  InputFieldDefaultMap,
  InputFieldDefinition,
  Inputs,
  OnPremConnectionInput,
  TriggerDefinition,
  TriggerOptionChoice,
  TriggerPayload,
  TriggerResult,
} from "../types";
import {
  isPollingTriggerDefinition,
  PollingTriggerDefinition,
} from "../types/PollingTriggerDefinition";
import {
  Action as ServerAction,
  Component as ServerComponent,
  Connection as ServerConnection,
  DataSource as ServerDataSource,
  Input as ServerInput,
  Trigger as ServerTrigger,
} from ".";
import { CleanFn, createPerform, createPollingPerform, InputCleaners, PerformFn } from "./perform";

/**
 * StructuredObject inputs do not carry a `clean` function (they have no
 * per-field value to clean — children carry their own). All other input
 * variants of InputFieldDefinition optionally carry `clean`.
 */
const cleanerFor = (input: InputFieldDefinition): CleanFn | undefined =>
  "clean" in input ? (input.clean as CleanFn | undefined) : undefined;

export const convertInput = (
  key: string,
  definition: InputFieldDefinition | OnPremConnectionInput | ConnectionInput,
): ServerInput => {
  // Cast for destructure: TypeScript can't safely destructure properties
  // that exist on only some members of the union (e.g. `default` is on
  // leaves but not StructuredObjectInputField). The runtime checks below
  // make this safe.
  const {
    default: defaultValue,
    type,
    label,
    collection,
    inputs: childInputs,
    ...rest
  } = definition as {
    default?: unknown;
    type: InputFieldDefinition["type"] | "template";
    label: string | { key: string; value: string };
    collection?: "valuelist" | "keyvaluelist";
    inputs?: Record<string, InputFieldDefinition>;
    [key: string]: unknown;
  };
  const keyLabel =
    collection === "keyvaluelist" && typeof label === "object" ? label.key : undefined;

  const nestedInputs =
    type === "structuredObject" && childInputs
      ? Object.entries(childInputs).map(([childKey, childDef]) =>
          convertInput(childKey, childDef as InputFieldDefinition),
        )
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

const convertAction = (
  actionKey: string,
  { inputs = {}, perform, ...action }: ActionDefinition<Inputs, any, boolean, any>,
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
  trigger:
    | TriggerDefinition<any>
    | PollingTriggerDefinition<any, ConfigVarResultCollection, TriggerPayload, boolean, any, any>,
  hooks?: ComponentHooks,
): ServerTrigger<TInputs, TActionInputs, TConfigVars, TPayload, TAllowsBranching, TResult> => {
  const { onInstanceDeploy, onInstanceDelete } = trigger;
  const webhookLifecycleHandlers =
    "webhookLifecycleHandlers" in trigger ? trigger.webhookLifecycleHandlers : undefined;
  const inputs: Inputs = trigger.inputs ?? {};
  const isPollingTrigger = isPollingTriggerDefinition(trigger);

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
  let convertedActionInputs: Array<ServerInput> = [];
  let performToUse: PerformFn;

  if (isPollingTrigger) {
    // Pull inputs up from the action and make them available on the trigger.
    // The inline cast is needed because isPollingTriggerDefinition()'s type
    // guard narrows on the call site only — assigning the result to the
    // `isPollingTrigger` variable (used elsewhere in this function) doesn't
    // carry the narrowing here.
    const { pollAction: action } = trigger as PollingTriggerDefinition<
      Inputs,
      ConfigVarResultCollection,
      TriggerPayload,
      boolean,
      any,
      any
    >;
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
    performToUse = createPerform((trigger as TriggerDefinition<any>).perform, {
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
    ...trigger,
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
    ...(isPollingTrigger ? { isPollingTrigger: true } : {}),
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
