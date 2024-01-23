import YAML from "yaml";
import { v4 as uuid } from "uuid";
import { assign, camelCase, pick } from "lodash";
import {
  IntegrationDefinition,
  ConfigVar,
  Flow,
  ScheduleType,
  EndpointType,
  ConfigPages,
  isDataSourceConfigVar,
  isConnectionConfigVar,
} from "../types";
import {
  Component as ServerComponent,
  Action as ServerAction,
  ActionPerformFunction as ServerActionPerformFunction,
  Connection as ServerConnection,
  DataSource as ServerDataSource,
  Trigger as ServerTrigger,
} from ".";
import { convertInput } from "./convert";
import {
  DefinitionVersion,
  RequiredConfigVariable as ServerRequiredConfigVariable,
  DefaultRequiredConfigVariable as ServerDefaultRequiredConfigVariable,
  Input as ServerInput,
  ConfigPage as ServerConfigPage,
} from "./integration";

export const convertIntegration = (
  definition: IntegrationDefinition<ConfigPages>
): ServerComponent => {
  // Generate a unique reference key that will be used to reference the
  // actions, triggers, data sources, and connections that are created
  // inline as part of the integration definition.
  const referenceKey = uuid();

  const configVars: Record<string, ConfigVar> = Object.assign(
    {},
    ...Object.values(definition.configPages ?? {}).map(
      ({ elements }) => elements
    )
  );

  return {
    ...codeNativeIntegrationComponent(definition, referenceKey, configVars),
    codeNativeIntegrationYAML: codeNativeIntegrationYaml(
      definition,
      referenceKey,
      configVars
    ),
  };
};

const convertConfigPages = (pages: ConfigPages): ServerConfigPage[] => {
  return Object.entries(pages).map(([name, { tagline, elements }]) => ({
    name,
    tagline,
    elements: Object.keys(elements).map((key) => ({
      type: "configVar",
      value: key,
    })),
  }));
};

const codeNativeIntegrationYaml = (
  {
    name,
    description,
    category,
    documentation,
    version,
    labels,
    endpointType,
    triggerPreprocessFlowConfig,
    flows,
    configPages,
  }: IntegrationDefinition<ConfigPages>,
  referenceKey: string,
  configVars: Record<string, ConfigVar>
): string => {
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
    definitionVersion: DefinitionVersion,
    isCodeNative: true,
    name,
    description,
    category,
    documentation,
    version,
    labels,
    requiredConfigVars: Object.entries(configVars || {}).map(
      ([key, configVar]) => convertConfigVar(key, configVar, referenceKey)
    ),
    endpointType,
    preprocessFlowName: hasPreprocessFlow ? preprocessFlows[0].name : undefined,
    externalCustomerIdField: fieldNameToReferenceInput(
      hasPreprocessFlow ? "onExecution" : "payload",
      preprocessFlowConfig?.externalCustomerIdField
    ),
    externalCustomerUserIdField: fieldNameToReferenceInput(
      hasPreprocessFlow ? "onExecution" : "payload",
      preprocessFlowConfig?.externalCustomerUserIdField
    ),
    flowNameField: fieldNameToReferenceInput(
      hasPreprocessFlow ? "onExecution" : "payload",
      preprocessFlowConfig?.flowNameField
    ),
    flows: flows.map((flow) => convertFlow(flow, referenceKey)),
    configPages: convertConfigPages(configPages ?? {}),
  };

  return YAML.stringify(result);
};

/** Converts a Flow into the structure necessary for YAML generation. */
const convertFlow = (
  flow: Flow<any>,
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
    name: "On Trigger",
    stableKey: `${flow.stableKey}-onTrigger`,
    description:
      "The function that will be executed by the flow to return an HTTP response.",
    isTrigger: true,
    errorConfig: "errorConfig" in flow ? { ...flow.errorConfig } : undefined,
    action: {
      key: flowFunctionKey(flow.name, "onTrigger"),
      component: { key: referenceKey, version: "LATEST", isPublic: false },
    },
  };

  if ("schedule" in flow && typeof flow.schedule === "object") {
    triggerStep.schedule = {
      type: "cronExpression" in flow.schedule ? "value" : "configVar",
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
    name: "On Execution",
    stableKey: `${flow.stableKey}-onExecution`,
    description: "The function that will be executed by the flow.",
    errorConfig: "errorConfig" in flow ? { ...flow.errorConfig } : undefined,
  };

  result.steps = [triggerStep, actionStep];

  return result;
};

/** Converts a Config Var into the structure necessary for YAML generation. */
const convertConfigVar = (
  key: string,
  configVar: ConfigVar,
  referenceKey: string
): ServerRequiredConfigVariable => {
  const meta = pick(configVar, [
    "visibleToCustomerDeployer",
    "visibleToOrgDeployer",
  ]);

  if (isConnectionConfigVar(configVar)) {
    return {
      ...pick(configVar, ["stableKey", "description", "orgOnly"]),
      key,
      dataType: "connection",
      connection: {
        component: { key: referenceKey, version: "LATEST", isPublic: false },
        key: camelCase(key),
      },
      inputs: Object.entries(configVar.inputs).reduce(
        (result, [key, input]) => {
          if (!input.shown || !input.default) {
            return result;
          }

          return {
            ...result,
            [key]: { type: "value", value: input.default },
          };
        },
        {}
      ),
      meta,
    };
  }

  const result = assign(
    { meta, key },
    pick(configVar, [
      "stableKey",
      "description",
      "orgOnly",
      "defaultValue",
      "dataType",
      "pickList",
      "scheduleType",
      "timeZone",
      "codeLanguage",
      "collectionType",
    ])
  ) as ServerDefaultRequiredConfigVariable;

  // Handle data sources.
  if (isDataSourceConfigVar(configVar)) {
    result.dataType = configVar.dataSourceType;
    result.dataSource = {
      key: camelCase(key),
      component: { key: referenceKey, version: "LATEST", isPublic: false },
    };
  }

  return result;
};

/** Maps the step name field to a fully qualified input. */
const fieldNameToReferenceInput = (
  stepName: string,
  fieldName: string | null | undefined
): ServerInput | undefined =>
  fieldName
    ? { type: "reference", value: `${stepName}.results.${fieldName}` }
    : undefined;

/** Actions and Triggers will be scoped to their flow by combining the flow
 *  name and the function name. This is to ensure that the keys are unique
 *  on the resulting object, which will be turned into a Component. */
const flowFunctionKey = (
  flowName: string,
  functionName: "onExecution" | "onTrigger"
): string => {
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
  }: IntegrationDefinition<ConfigPages>,
  referenceKey: string,
  configVars: Record<string, ConfigVar>
): ServerComponent => {
  const convertedActions = flows.reduce<Record<string, ServerAction>>(
    (result, { name, onExecution }) => {
      const key = flowFunctionKey(name, "onExecution");
      return {
        ...result,
        [key]: {
          key,
          display: {
            label: `${name} - onExecution`,
            description: "The function that will be executed by the flow.",
          },
          perform: onExecution as ServerActionPerformFunction,
          inputs: [],
        },
      };
    },
    {}
  );

  const convertedTriggers = flows.reduce<Record<string, ServerTrigger>>(
    (result, { name, onTrigger, onInstanceDeploy, onInstanceDelete }) => {
      const key = flowFunctionKey(name, "onTrigger");
      return {
        ...result,
        [key]: {
          key,
          display: {
            label: `${name} - onTrigger`,
            description:
              "The function that will be executed by the flow to return an HTTP response.",
          },
          perform: onTrigger,
          onInstanceDeploy: onInstanceDeploy,
          onInstanceDelete: onInstanceDelete,
          inputs: [],
          scheduleSupport: "valid",
          synchronousResponseSupport: "valid",
        },
      };
    },
    {}
  );

  const convertedDataSources = Object.entries(configVars).reduce<
    Record<string, ServerDataSource>
  >((result, [key, configVar]) => {
    if (!isDataSourceConfigVar(configVar)) {
      return result;
    }

    const dataSource = pick(configVar, ["perform", "dataSourceType"]);

    return {
      ...result,
      [key]: {
        ...dataSource,
        key: camelCase(key),
        display: {
          label: key,
          description: key,
        },
        inputs: [],
      },
    };
  }, {});

  const convertedConnections = Object.entries(configVars).reduce<
    ServerConnection[]
  >((result, [key, configVar]) => {
    if (!isConnectionConfigVar(configVar)) {
      return result;
    }

    const convertedInputs = Object.entries(configVar.inputs).map(
      ([key, value]) => convertInput(key, value)
    );

    const connection = pick(configVar, ["oauth2Type", "iconPath"]);

    return [
      ...result,
      {
        ...connection,
        inputs: convertedInputs,
        key: camelCase(key),
        label: key,
      },
    ];
  }, []);

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
