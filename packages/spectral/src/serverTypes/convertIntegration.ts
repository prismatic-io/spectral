import YAML from "yaml";
import { v4 as uuid } from "uuid";
import { assign, camelCase, pick } from "lodash";
import {
  IntegrationDefinition,
  ConfigVar,
  Flow,
  EndpointType,
  ConfigPages,
  isDataSourceDefinitionConfigVar,
  isConnectionDefinitionConfigVar,
  isScheduleConfigVar,
  isConnectionReferenceConfigVar,
  ComponentReference,
  isComponentReference,
  isDataSourceReferenceConfigVar,
  ComponentRegistry,
  ComponentManifest,
  ComponentManifestAction,
} from "../types";
import {
  Component as ServerComponent,
  Action as ServerAction,
  ActionPerformFunction as ServerActionPerformFunction,
  Connection as ServerConnection,
  DataSource as ServerDataSource,
  Trigger as ServerTrigger,
  TriggerPerformFunction,
  TriggerEventFunction,
  ActionPerformFunction,
  ActionContext,
} from ".";
import { convertInput } from "./convert";
import {
  DefinitionVersion,
  RequiredConfigVariable as ServerRequiredConfigVariable,
  DefaultRequiredConfigVariable as ServerDefaultRequiredConfigVariable,
  Input as ServerInput,
  ConfigPage as ServerConfigPage,
  ComponentReference as ServerComponentReference,
} from "./integration";

export const convertIntegration = (
  definition: IntegrationDefinition
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

const convertConfigPages = (
  pages: ConfigPages
): ServerConfigPage[] | undefined => {
  if (!pages || !Object.keys(pages).length) {
    return;
  }

  return Object.entries(pages).map<ServerConfigPage>(
    ([name, { tagline, elements }]) => ({
      name,
      tagline,
      elements: Object.keys(elements).map((key) => ({
        type: "configVar",
        value: key,
      })),
    })
  );
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
    componentRegistry = {},
  }: IntegrationDefinition,
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
  const nonPreprocessFlowTypes: EndpointType[] = [
    "instance_specific",
    "shared_instance",
  ];
  if (
    nonPreprocessFlowTypes.includes(endpointType || "flow_specific") &&
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
    flows: flows.map((flow) =>
      convertFlow(flow, componentRegistry, referenceKey)
    ),
    configPages: convertConfigPages(configPages ?? ({} as ConfigPages)),
  };

  return YAML.stringify(result);
};

const convertComponentReference = <TValue>({
  key,
  component: componentRef,
  values,
}: ComponentReference<TValue>): {
  ref: ServerComponentReference;
  inputs: Record<string, ServerInput>;
} => {
  const component =
    typeof componentRef === "string"
      ? {
          key: componentRef,
          // TODO: Update to use `signature` when support is added.
          version: "LATEST" as const,
          isPublic: true,
        }
      : {
          key: componentRef.key,
          // TODO: Update to use `signature` when support is added.
          version: "LATEST" as const,
          isPublic: componentRef.isPublic,
        };

  const inputs = Object.entries(values ?? {}).reduce((result, [key, value]) => {
    if ("value" in value) {
      const type = value.value instanceof Object ? "complex" : "value";
      const valueExpr =
        value.value instanceof Object && !Array.isArray(value.value)
          ? Object.entries(value.value).map<ServerInput>(([k, v]) => ({
              name: { type: "value", value: k },
              type: "value",
              value: v,
            }))
          : value.value;
      return { ...result, [key]: { type: type, value: valueExpr } };
    }
    if ("configVar" in value) {
      return {
        ...result,
        [key]: { type: "configVar", value: value.configVar },
      };
    }
    return result;
  }, {});

  return {
    ref: { key, component },
    inputs,
  };
};

const convertComponentRegistry = (componentRegistry: ComponentRegistry) =>
  Object.values(componentRegistry).map(({ key, public: isPublic }) => ({
    key,
    // TODO: Update to use `signature` when support is added.
    version: "LATEST" as const,
    isPublic,
  }));

/** Converts a Flow into the structure necessary for YAML generation. */
const convertFlow = (
  flow: Flow,
  componentRegistry: ComponentRegistry,
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
  };

  if (typeof flow.onTrigger === "function") {
    triggerStep.action = {
      key: flowFunctionKey(flow.name, "onTrigger"),
      component: {
        key: referenceKey,
        // We always want to use latest for the CNI-backed trigger
        version: "LATEST",
        isPublic: false,
      },
    };
  } else if (isComponentReference(flow.onTrigger)) {
    const { ref, inputs } = convertComponentReference(flow.onTrigger);
    triggerStep.action = ref;
    triggerStep.inputs = inputs;
  } else {
    const hasSchedule = "schedule" in flow && typeof flow.schedule === "object";
    const key = hasSchedule ? "schedule" : "webhook";
    triggerStep.action = {
      key,
      component: {
        key: `${key}-triggers`,
        // TODO: Determine how we intend to support management triggers.
        version: "LATEST",
        isPublic: true,
      },
    };
  }

  if ("schedule" in flow && typeof flow.schedule === "object") {
    const { schedule } = flow;
    triggerStep.schedule = {
      type: "configVar" in schedule ? "configVar" : "value",
      value: "configVar" in schedule ? schedule.configVar : schedule.value,
      meta: {
        scheduleType: "custom",
        timeZone: schedule.timezone ?? "",
      },
    };
    delete result.schedule;
  }

  const actionStep: Record<string, unknown> = {
    action: {
      key: flowFunctionKey(flow.name, "onExecution"),
      component: {
        key: referenceKey,
        // We always want to use latest for the CNI-backed execution action
        version: "LATEST",
        isPublic: false,
      },
    },
    name: "On Execution",
    stableKey: `${flow.stableKey}-onExecution`,
    description: "The function that will be executed by the flow.",
    errorConfig: "errorConfig" in flow ? { ...flow.errorConfig } : undefined,
  };

  result.steps = [triggerStep, actionStep];

  result.supplementalComponents = convertComponentRegistry(componentRegistry);

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

  if (isConnectionDefinitionConfigVar(configVar)) {
    return {
      ...pick(configVar, ["stableKey", "description", "orgOnly"]),
      key,
      dataType: "connection",
      connection: {
        component: {
          key: referenceKey,
          // We always want to use latest for the CNI-backed connection
          version: "LATEST",
          isPublic: false,
        },
        key: camelCase(key),
      },
      inputs: Object.entries(configVar.inputs).reduce(
        (result, [key, input]) => {
          if (input.shown === false) {
            return result;
          }

          const defaultValue = input.collection ? [] : "";
          return {
            ...result,
            [key]: {
              type: input.collection ? "complex" : "value",
              value: input.default || defaultValue,
            },
          };
        },
        {}
      ),
      meta,
    };
  }

  if (isConnectionReferenceConfigVar(configVar)) {
    const { ref, inputs } = convertComponentReference(configVar.connection);
    return {
      ...pick(configVar, ["stableKey", "description", "orgOnly"]),
      key,
      dataType: "connection",
      connection: { ...ref, template: configVar.connection.template },
      inputs,
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
      "timeZone",
      "codeLanguage",
      "collectionType",
    ])
  ) as ServerDefaultRequiredConfigVariable;

  if (isScheduleConfigVar(configVar)) {
    result.scheduleType = "custom";
  }

  if (isDataSourceDefinitionConfigVar(configVar)) {
    result.dataType = configVar.dataSourceType;
    result.dataSource = {
      key: camelCase(key),
      component: {
        key: referenceKey,
        // We always want to use latest for the CNI-backed data source
        version: "LATEST",
        isPublic: false,
      },
    };
  }

  if (isDataSourceReferenceConfigVar(configVar)) {
    const { ref, inputs } = convertComponentReference(configVar.dataSource);
    result.dataType = configVar.dataSourceType;
    result.dataSource = ref;
    result.inputs = inputs;
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

type ComponentActionInvokeFunction = <TValues extends Record<string, unknown>>(
  action: {
    component: string;
    action: string;
    isPublic: boolean;
    version: number;
  },
  context: ActionContext,
  values: TValues
) => Promise<unknown>;

const convertOnExecution =
  (
    onExecution: ActionPerformFunction,
    componentRegistry: ComponentRegistry
  ): ServerActionPerformFunction =>
  (context, params) => {
    // @ts-expect-error _components isn't part of the public API
    const { _components, ...remainingContext } = context;

    const invoke = (_components as { invoke: ComponentActionInvokeFunction })
      .invoke;

    const componentMethods = Object.entries(componentRegistry).reduce<
      Record<string, ComponentManifest["actions"]>
    >((acc, [componentKey, { actions, public: isPublic }]) => {
      return {
        ...acc,
        [componentKey]: Object.keys(actions).reduce<
          Record<string, ComponentManifestAction>
        >(
          (acc, actionKey) => ({
            ...acc,
            [actionKey]: (values) => {
              return invoke(
                {
                  component: componentKey,
                  action: actionKey,
                  isPublic,
                  version: 2,
                },
                context,
                values
              );
            },
          }),
          {}
        ),
      };
    }, {});

    return onExecution(
      { ...remainingContext, components: componentMethods },
      params
    );
  };

/** Creates the structure necessary to import a Component as part of a
 *  Code Native integration. */
const codeNativeIntegrationComponent = (
  {
    name,
    iconPath,
    description,
    flows = [],
    componentRegistry = {},
  }: IntegrationDefinition,
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
          perform: convertOnExecution(
            onExecution as ServerActionPerformFunction,
            componentRegistry
          ),
          inputs: [],
        },
      };
    },
    {}
  );

  const convertedTriggers = flows.reduce<Record<string, ServerTrigger>>(
    (result, { name, onTrigger, onInstanceDeploy, onInstanceDelete }) => {
      if (typeof onTrigger !== "function") {
        return result;
      }

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
          perform: onTrigger as TriggerPerformFunction,
          onInstanceDeploy: onInstanceDeploy as TriggerEventFunction,
          hasOnInstanceDeploy: !!onInstanceDeploy,
          onInstanceDelete: onInstanceDeploy as TriggerEventFunction,
          hasOnInstanceDelete: !!onInstanceDelete,
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
    if (!isDataSourceDefinitionConfigVar(configVar)) {
      return result;
    }

    const camelKey = camelCase(key);
    const dataSource = pick(configVar, ["perform", "dataSourceType"]);

    return {
      ...result,
      [camelKey]: {
        ...dataSource,
        key: camelKey,
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
    if (!isConnectionDefinitionConfigVar(configVar)) {
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
