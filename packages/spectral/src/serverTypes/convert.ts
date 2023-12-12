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
  EndpointType,
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
    version,
    labels,
    configVars,
    endpointType,
    triggerPreprocessFlowConfig,
    flows,
    configPages,
  }: IntegrationDefinition,
  referenceKey: string
): string => {
  const DEFINITION_VERSION = 7;

  // Find the preprocess flow config on the flow, if one exists.
  const preprocessFlows = flows.filter((flow) => flow.preprocessFlowConfig);

  // Do some validation of preprocess flow configs.
  if (preprocessFlows.length > 1) {
    throw new Error("Only one flow may define a Preprocess Flow Config.");
  }
  if (preprocessFlows.length && triggerPreprocessFlowConfig) {
    throw new Error(
      "Integration must not define both a Trigger Preprocess Flow Config and a Preprocess Flow."
    );
  }

  const hasPreprocessFlow = preprocessFlows.length > 0;
  const preprocessFlowConfig = hasPreprocessFlow
    ? preprocessFlows[0].preprocessFlowConfig
    : triggerPreprocessFlowConfig;
  if (
    [EndpointType.InstanceSpecific, EndpointType.SharedInstance].includes(
      endpointType || EndpointType.FlowSpecific
    ) &&
    !preprocessFlowConfig
  ) {
    throw new Error(
      "Integration with specified EndpointType must define either a Trigger Preprocess Flow Config or a Preprocess Flow."
    );
  }

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
    version,
    labels,
    requiredConfigVars: configVars?.map((configVar) =>
      convertConfigVar(configVar, referenceKey)
    ),
    endpointType,
    preprocessFlowName: hasPreprocessFlow ? preprocessFlows[0].name : undefined,
    externalCustomerIdField: fieldNameToReferenceInput(
      hasPreprocessFlow ? "action" : "payload",
      preprocessFlowConfig?.externalCustomerIdField
    ),
    externalCustomerUserIdField: fieldNameToReferenceInput(
      hasPreprocessFlow ? "action" : "payload",
      preprocessFlowConfig?.externalCustomerUserIdField
    ),
    flowNameField: fieldNameToReferenceInput(
      hasPreprocessFlow ? "action" : "payload",
      preprocessFlowConfig?.flowNameField
    ),
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
  delete result.onTrigger;
  delete result.trigger;
  delete result.onInstanceDeploy;
  delete result.onInstanceDelete;
  delete result.onExecution;
  delete result.preprocessFlowConfig;
  delete result.errorConfig;

  const triggerStep: Record<string, unknown> = {
    name: `${flow.name} - onTrigger`,
    description:
      "The function that will be executed by the flow to return an HTTP response.",
    isTrigger: true,
    errorConfig: "errorConfig" in flow ? { ...flow.errorConfig } : undefined,
  };

  if ("onTrigger" in flow) {
    triggerStep.action = {
      key: flowFunctionKey(flow.name, "onTrigger"),
      component: { key: referenceKey, version: "LATEST", isPublic: false },
    };
  } else {
    triggerStep.action = {
      key: flow.trigger.key,
      component: flow.trigger.component,
    };

    if ("inputs" in flow.trigger) {
      triggerStep.inputs = flow.trigger.inputs;
    }
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
      key: flowFunctionKey(flow.name, "onExecution"),
      component: { key: referenceKey, version: "LATEST", isPublic: false },
    },
    name: `${flow.name} - onExecution`,
    description: "The function that will be executed by the flow.",
    errorConfig: "errorConfig" in flow ? { ...flow.errorConfig } : undefined,
  };

  result.steps = [triggerStep, actionStep];

  return result;
};

/** Converts a Config Var into the structure necessary for YAML generation. */
const convertConfigVar = (
  configVar: ConfigVar,
  referenceKey: string
): Record<string, unknown> => {
  // This is unfortunate but we need to strip out some fields that are not
  // relevant to config vars.
  const fields = [
    "key",
    "description",
    "orgOnly",
    "inputs",
    "defaultValue",
    "dataType",
    "pickList",
    "scheduleType",
    "timeZone",
    "codeLanguage",
    "collectionType",
    "dataSource",
  ];
  const result = Object.entries(configVar).reduce<
    Record<string, unknown> & { meta: Record<string, unknown> }
  >(
    (result, [key, value]) => {
      if (!fields.includes(key)) {
        return result;
      }
      return { ...result, [key]: value };
    },
    { meta: {} }
  );

  // Handle some non-standard fields.
  if ("visibleToOrgDeployer" in configVar) {
    result.meta.visibleToOrgDeployer = configVar.visibleToOrgDeployer;
  }
  if ("visibleToCustomerDeployer" in configVar) {
    result.meta.visibleToCustomerDeployer = configVar.visibleToCustomerDeployer;
  }

  // Handle connections.
  if ("label" in configVar || "component" in configVar) {
    result.dataType = "connection";
    if ("component" in configVar) {
      // This is a reference to another Component's connection.
      result.connection = {
        key: configVar.key,
        component: configVar.component,
      };
    } else {
      // This refers to a connection we are creating.
      result.connection = {
        key: configVar.key,
        component: { key: referenceKey, version: "LATEST", isPublic: false },
      };
      result.description = configVar.label;

      // Convert connection inputs to the inputs expected in the YAML.
      // FIXME: This is just a placeholder for now.
      result.inputs = Object.keys(configVar.inputs).reduce((result, key) => {
        return {
          ...result,
          [key]: {
            type: SimpleInputValueType.Value,
            value: "",
          },
        };
      }, {});
    }
  }

  // Handle data source references.
  if ("dataSource" in result && typeof result.dataSource === "string") {
    // This is a reference to a data source we are creating.
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
    name,
    iconPath,
    description,
    flows = [],
    dataSources = {},
    configVars = [],
  }: IntegrationDefinition,
  referenceKey: string
): ServerComponent => {
  const convertedActions = flows.reduce((result, { name, onExecution }) => {
    const actionKey = flowFunctionKey(name, "onExecution");
    return {
      ...result,
      [actionKey]: convertAction(actionKey, {
        display: {
          label: `${name} - onExecution`,
          description: "The function that will be executed by the flow.",
        },
        perform: onExecution,
        inputs: {},
      }),
    };
  }, {});

  const convertedTriggers = flows.reduce((result, flow) => {
    // Filter out TriggerReferences.
    if ("trigger" in flow) return result;

    const { name, onTrigger, onInstanceDeploy, onInstanceDelete } = flow;

    const triggerKey = flowFunctionKey(name, "onTrigger");
    return {
      ...result,
      [triggerKey]: convertTrigger(triggerKey, {
        display: {
          label: `${name} - onTrigger`,
          description:
            "The function that will be executed by the flow to return an HTTP response.",
        },
        perform: onTrigger,
        onInstanceDeploy: onInstanceDeploy,
        onInstanceDelete: onInstanceDelete,
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

  const convertedConnections = configVars.reduce<ServerConnection[]>(
    (result, configVar) => {
      if (!("label" in configVar)) {
        return result;
      }

      // Remove a few fields that are not relevant to connections.
      const {
        /* eslint-disable @typescript-eslint/no-unused-vars */
        orgOnly,
        visibleToOrgDeployer,
        visibleToCustomerDeployer,
        /* eslint-enable @typescript-eslint/no-unused-vars */
        ...connection
      } = configVar;

      return [...result, convertConnection(connection)];
    },
    []
  );

  return {
    key: referenceKey,
    display: {
      label: referenceKey,
      iconPath,
      description: description || name,
    },
    connections: convertedConnections,
    actions: convertedActions,
    triggers: convertedTriggers,
    dataSources: convertedDataSources,
  };
};
