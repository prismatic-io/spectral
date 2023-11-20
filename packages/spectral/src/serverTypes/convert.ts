import YAML from "yaml";
import { v4 as uuid } from "uuid";
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
  IntegrationDefinition,
  InputValue,
  SimpleInputValueType,
  ConfigVar,
  Flow,
  ScheduleType,
} from "../types";
import {
  Component as ServerComponent,
  Connection as ServerConnection,
  Action as ServerAction,
  Trigger as ServerTrigger,
  Input as ServerInput,
  DataSource as ServerDataSource,
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
  { inputs = {}, perform, ...action }: ActionDefinition<Inputs, boolean, any>,
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
  {
    inputs = {},
    perform,
    onInstanceDeploy,
    onInstanceDelete,
    ...trigger
  }: TriggerDefinition<Inputs, boolean, any>,
  hooks?: ComponentHooks
): ServerTrigger => {
  const convertedInputs = Object.entries(inputs).map(([key, value]) =>
    convertInput(key, value)
  );
  const inputCleaners = Object.entries(inputs).reduce<InputCleaners>(
    (result, [key, { clean }]) => ({ ...result, [key]: clean }),
    {}
  );

  const result: ServerTrigger = {
    ...trigger,
    key: triggerKey,
    inputs: convertedInputs,
    perform: createPerform(perform, {
      inputCleaners,
      errorHandler: hooks?.error,
    }),
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

  return result;
};

const convertDataSource = (
  dataSourceKey: string,
  { inputs = {}, perform, ...dataSource }: DataSourceDefinition<Inputs, any>,
  hooks?: ComponentHooks
): ServerDataSource => {
  const convertedInputs = Object.entries(inputs).map(([key, value]) =>
    convertInput(key, value)
  );
  const inputCleaners = Object.entries(inputs).reduce<InputCleaners>(
    (result, [key, { clean }]) => ({ ...result, [key]: clean }),
    {}
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
  const convertedInputs = Object.entries(inputs).map(([key, value]) =>
    convertInput(key, value)
  );

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
    {}
  );

  const convertedTriggers = Object.entries(triggers).reduce(
    (result, [triggerKey, trigger]) => ({
      ...result,
      [triggerKey]: convertTrigger(triggerKey, trigger, hooks),
    }),
    {}
  );

  const convertedDataSources = Object.entries(dataSources).reduce(
    (result, [dataSourceKey, dataSource]) => ({
      ...result,
      [dataSourceKey]: convertDataSource(dataSourceKey, dataSource, hooks),
    }),
    {}
  );

  return {
    ...definition,
    connections: connections.map(convertConnection),
    actions: convertedActions,
    triggers: convertedTriggers,
    dataSources: convertedDataSources,
  };
};

export const convertIntegration = (
  definition: IntegrationDefinition
): ServerComponent => {
  // Generate a unique reference key that will be used to reference the
  // actions, triggers, data sources, and connections that are created
  // inline as part of the integration definition.
  const referenceKey = uuid();

  return {
    ...codeNativeIntegrationComponent(definition, referenceKey),
    codeNativeIntegrationYAML: codeNativeIntegrationYaml(
      definition,
      referenceKey
    ),
  };
};

const codeNativeIntegrationYaml = (
  {
    name,
    description,
    category,
    documentation,
    configVars,
    endpointType,
    preprocessFlowName,
    externalCustomerIdField,
    externalCustomerUserIdField,
    flowNameField,
    flows,
    configPages,
  }: IntegrationDefinition,
  referenceKey: string
): string => {
  const DEFINITION_VERSION = 7;

  // Transform the IntegrationDefinition into the structure that is appropriate
  // for generating YAML, which will then be used by the Prismatic API to import
  // the integration as a Code Native Integration.
  const result = {
    definitionVersion: DEFINITION_VERSION,
    isCodeNative: true,
    name,
    description,
    category,
    documentation,
    requiredConfigVars: configVars?.map((configVar) =>
      convertConfigVar(configVar, referenceKey)
    ),
    endpointType,
    preprocessFlowName,
    externalCustomerIdField: fieldNameToReferenceInput(
      "action",
      externalCustomerIdField
    ),
    externalCustomerUserIdField: fieldNameToReferenceInput(
      "action",
      externalCustomerUserIdField
    ),
    flowNameField: fieldNameToReferenceInput("payload", flowNameField),
    flows: flows.map((flow) => convertFlow(flow, referenceKey)),
    configPages,
  };

  return YAML.stringify(result);
};

/** Converts a Flow into the structure necessary for YAML generation. */
const convertFlow = (
  flow: Flow,
  referenceKey: string
): Record<string, unknown> => {
  const result: Record<string, unknown> = {
    ...flow,
  };
  delete result.trigger;
  delete result.action;

  const triggerStep: Record<string, unknown> = {
    name: "trigger",
    isTrigger: true,
    errorConfig:
      "errorConfig" in flow.trigger ? flow.trigger.errorConfig : undefined,
  };

  if ("perform" in flow.trigger) {
    triggerStep.action = {
      key: flowFunctionKey(flow.name, "trigger"),
      component: { key: referenceKey, version: "LATEST", isPublic: false },
    };
  } else {
    triggerStep.action = {
      key: flow.trigger.key,
      component: flow.trigger.component,
    };
  }

  if ("inputs" in flow.trigger) {
    triggerStep.inputs = flow.trigger.inputs;
    delete result.inputs;
  }

  if ("schedule" in flow && typeof flow.schedule === "object") {
    triggerStep.schedule = {
      type:
        "cronExpression" in flow.schedule
          ? SimpleInputValueType.Value
          : SimpleInputValueType.ConfigVar,
      value:
        "cronExpression" in flow.schedule
          ? flow.schedule.cronExpression
          : flow.schedule.configVarKey,
      meta: {
        scheduleType: ScheduleType.Custom,
        timeZone: flow.schedule.timeZone,
      },
    };
    delete result.schedule;
  }

  const actionStep: Record<string, unknown> = {
    action: {
      key: flowFunctionKey(flow.name, "action"),
      component: { key: referenceKey, version: "LATEST", isPublic: false },
    },
    name: "action",
    errorConfig:
      "errorConfig" in flow.action ? flow.action.errorConfig : undefined,
  };

  result.steps = [triggerStep, actionStep];

  return result;
};

/** Converts a Config Var into the structure necessary for YAML generation. */
const convertConfigVar = (
  configVar: ConfigVar,
  referenceKey: string
): Record<string, unknown> => {
  const result: Record<string, unknown> & { meta: Record<string, unknown> } = {
    ...configVar,
    meta: {},
  };

  // Handle some non-standard fields.
  if ("visibleToOrgDeployer" in result) {
    result.meta.visibleToOrgDeployer = result.visibleToOrgDeployer;
    delete result.visibleToOrgDeployer;
  }

  if ("visibleToCustomerDeployer" in result) {
    result.meta.visibleToCustomerDeployer = result.visibleToCustomerDeployer;
    delete result.visibleToCustomerDeployer;
  }

  if ("connection" in result && typeof result.connection === "string") {
    result.connection = {
      key: result.connection,
      component: { key: referenceKey, version: "LATEST", isPublic: false },
    };
  }

  if ("dataSource" in result && typeof result.dataSource === "string") {
    result.dataSource = {
      key: result.dataSource,
      component: { key: referenceKey, version: "LATEST", isPublic: false },
    };
  }

  return result;
};

/** Maps the step name field to a fully qualified input. */
const fieldNameToReferenceInput = (
  stepName: string,
  fieldName: string | null | undefined
): InputValue | undefined => {
  if (!fieldName) {
    return undefined;
  }
  return {
    type: SimpleInputValueType.Reference,
    value: `${stepName}.results.${fieldName}`,
  };
};

/** Actions and Triggers will be scoped to their flow by combining the flow
 *  name and the function name. This is to ensure that the keys are unique
 *  on the resulting object, which will be turned into a Component. */
const flowFunctionKey = (flowName: string, functionName: string): string => {
  const flowKey = flowName
    .replace(/[^0-9a-zA-Z]+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("");

  // functionName is only going to be either 'action' or 'trigger'.
  return `${flowKey}_${functionName}`;
};

/** Creates the structure necessary to import a Component as part of a
 *  Code Native integration. */
const codeNativeIntegrationComponent = (
  {
    iconPath,
    description,
    flows = [],
    dataSources = {},
    connections = [],
  }: IntegrationDefinition,
  referenceKey: string
): ServerComponent => {
  const convertedActions = flows.reduce((result, { name, action }) => {
    const actionKey = flowFunctionKey(name, "action");
    return {
      ...result,
      [actionKey]: convertAction(actionKey, {
        ...action,
        display: { label: "action", description: "" },
        inputs: {},
      }),
    };
  }, {});

  const convertedTriggers = flows.reduce((result, { name, trigger }) => {
    // Filter out TriggerReferences.
    if (typeof trigger !== "object" || !("perform" in trigger)) return result;

    const triggerKey = flowFunctionKey(name, "trigger");
    return {
      ...result,
      [triggerKey]: convertTrigger(triggerKey, {
        ...trigger,
        display: { label: "trigger", description: "" },
        inputs: {},
        scheduleSupport: "valid",
        synchronousResponseSupport: "valid",
      }),
    };
  }, {});

  const convertedDataSources = Object.entries(dataSources).reduce(
    (result, [dataSourceKey, dataSource]) => ({
      ...result,
      [dataSourceKey]: convertDataSource(dataSourceKey, {
        ...dataSource,
        inputs: {},
      }),
    }),
    {}
  );

  return {
    key: referenceKey,
    display: { label: referenceKey, iconPath, description: description || "" },
    connections: connections.map(convertConnection),
    actions: convertedActions,
    triggers: convertedTriggers,
    dataSources: convertedDataSources,
  };
};
