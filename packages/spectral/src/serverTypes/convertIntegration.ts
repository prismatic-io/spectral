import YAML from "yaml";
import { v4 as uuid } from "uuid";
import assign from "lodash/assign";
import camelCase from "lodash/camelCase";
import pick from "lodash/pick";
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
  ComponentManifestAction,
  PermissionAndVisibilityType,
  CollectionType,
  KeyValuePair,
  ComponentManifest,
  isJsonFormConfigVar,
  isJsonFormDataSourceConfigVar,
  TriggerReference,
  TriggerEventFunctionReturn,
  isConnectionScopedConfigVar,
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
  TriggerPayload,
  TriggerResult,
} from ".";
import { convertInput } from "./convertComponent";
import {
  DefinitionVersion,
  RequiredConfigVariable as ServerRequiredConfigVariable,
  DefaultRequiredConfigVariable as ServerDefaultRequiredConfigVariable,
  Input as ServerInput,
  ConfigPage as ServerConfigPage,
  ComponentReference as ServerComponentReference,
} from "./integration";
import merge from "lodash/merge";
import { createInvokeFlow } from "./perform";
import { createDebugContext, logDebugResults } from "./context";

export const convertIntegration = (definition: IntegrationDefinition): ServerComponent => {
  // Generate a unique reference key that will be used to reference the
  // actions, triggers, data sources, and connections that are created
  // inline as part of the integration definition.
  const referenceKey = uuid();

  const scopedConfigVars = definition.scopedConfigVars ?? {};
  const configVars: Record<string, ConfigVar> = Object.values({
    configPages: definition.configPages ?? {},
    userLevelConfigPages: definition.userLevelConfigPages ?? {},
  }).reduce<Record<string, ConfigVar>>(
    (acc, configPages) => ({
      ...acc,
      ...Object.values(configPages).reduce<Record<string, ConfigVar>>(
        (acc, configPage) =>
          Object.entries(configPage.elements).reduce<Record<string, ConfigVar>>(
            (acc, [key, element]) => {
              // "string" elements are HTML elements and should be ignored.
              if (typeof element === "string") {
                return acc;
              }

              if (key in acc || key in scopedConfigVars) {
                throw new Error(`Duplicate config var key: "${key}"`);
              }

              return {
                ...acc,
                [key]: element,
              };
            },
            acc,
          ),
        {},
      ),
    }),
    {},
  );

  const cniComponent = codeNativeIntegrationComponent(definition, referenceKey, configVars);

  const cniYaml = codeNativeIntegrationYaml(definition, referenceKey, configVars);

  return {
    ...cniComponent,
    codeNativeIntegrationYAML: cniYaml,
  };
};

const convertConfigPages = (
  pages: ConfigPages | undefined,
  userLevelConfigured: boolean,
): ServerConfigPage[] => {
  if (!pages || !Object.keys(pages).length) {
    return [];
  }

  return Object.entries(pages).map<ServerConfigPage>(([name, { tagline, elements }]) => ({
    name,
    tagline,
    ...(userLevelConfigured ? { userLevelConfigured } : {}),
    elements: Object.entries(elements).map(([key, value]) =>
      typeof value === "string"
        ? {
            type: "htmlElement",
            value,
          }
        : {
            type: "configVar",
            value: key,
          },
    ),
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
    userLevelConfigPages,
    scopedConfigVars,
    componentRegistry = {},
  }: IntegrationDefinition,
  referenceKey: string,
  configVars: Record<string, ConfigVar>,
): string => {
  // Find the preprocess flow config on the flow, if one exists.
  const preprocessFlows = flows.filter((flow) => flow.preprocessFlowConfig);

  // Do some validation of preprocess flow configs.
  if (preprocessFlows.length > 1) {
    throw new Error("Only one flow may define a Preprocess Flow Config.");
  }

  if (preprocessFlows.length && triggerPreprocessFlowConfig) {
    throw new Error(
      "Integration must not define both a Trigger Preprocess Flow Config and a Preprocess Flow.",
    );
  }

  const hasPreprocessFlow = preprocessFlows.length > 0;
  const preprocessFlowConfig = hasPreprocessFlow
    ? preprocessFlows[0].preprocessFlowConfig
    : triggerPreprocessFlowConfig;
  const nonPreprocessFlowTypes: EndpointType[] = ["instance_specific", "shared_instance"];
  if (nonPreprocessFlowTypes.includes(endpointType || "flow_specific") && !preprocessFlowConfig) {
    throw new Error(
      "Integration with specified EndpointType must define either a Trigger Preprocess Flow Config or a Preprocess Flow.",
    );
  }

  const configVarMap = Object.entries(scopedConfigVars ?? {}).reduce(
    (acc, [key, value]) => {
      if (typeof value === "string") {
        return acc;
      }

      return {
        ...acc,
        [key]: value,
      };
    },
    { ...(configVars ?? {}) },
  );

  const requiredConfigVars = Object.entries(configVarMap).map(([key, configVar]) =>
    convertConfigVar(key, configVar, referenceKey, componentRegistry),
  );

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
    requiredConfigVars,
    endpointType,
    preprocessFlowName: hasPreprocessFlow ? preprocessFlows[0].name : undefined,
    externalCustomerIdField: fieldNameToReferenceInput(
      hasPreprocessFlow ? "onExecution" : "payload",
      preprocessFlowConfig?.externalCustomerIdField,
    ),
    externalCustomerUserIdField: fieldNameToReferenceInput(
      hasPreprocessFlow ? "onExecution" : "payload",
      preprocessFlowConfig?.externalCustomerUserIdField,
    ),
    flowNameField: fieldNameToReferenceInput(
      hasPreprocessFlow ? "onExecution" : "payload",
      preprocessFlowConfig?.flowNameField,
    ),
    flows: flows.map((flow) => convertFlow(flow, componentRegistry, referenceKey)),
    configPages: [
      ...convertConfigPages(configPages, false),
      ...convertConfigPages(userLevelConfigPages, true),
    ],
  };

  return YAML.stringify(result);
};

interface VisibilityAndPermissionValue {
  visibleToOrgDeployer: boolean;
  visibleToCustomerDeployer: boolean;
  orgOnly: boolean;
}

const permissionAndVisibilityTypeValueMap: Record<
  PermissionAndVisibilityType,
  VisibilityAndPermissionValue
> = {
  customer: {
    orgOnly: false,
    visibleToOrgDeployer: true,
    visibleToCustomerDeployer: true,
  },
  embedded: {
    orgOnly: false,
    visibleToOrgDeployer: true,
    visibleToCustomerDeployer: false,
  },
  organization: {
    orgOnly: true,
    visibleToOrgDeployer: true,
    visibleToCustomerDeployer: false,
  },
};

const getPermissionAndVisibilityValues = ({
  permissionAndVisibilityType = "customer",
  visibleToOrgDeployer = true,
}: {
  permissionAndVisibilityType?: PermissionAndVisibilityType;
  visibleToOrgDeployer?: boolean;
}) => {
  return {
    ...permissionAndVisibilityTypeValueMap[permissionAndVisibilityType],
    ...(visibleToOrgDeployer !== undefined ? { visibleToOrgDeployer } : {}),
  };
};

/** Converts permission and visibility properties into `meta` properties for inputs. */
const convertInputPermissionAndVisibility = ({
  permissionAndVisibilityType,
  visibleToOrgDeployer,
}: {
  permissionAndVisibilityType?: PermissionAndVisibilityType;
  visibleToOrgDeployer?: boolean;
}) => {
  const meta = getPermissionAndVisibilityValues({
    permissionAndVisibilityType,
    visibleToOrgDeployer,
  });

  return meta;
};

/** Converts permission and visibility properties into `meta` properties for config vars. */
const convertConfigVarPermissionAndVisibility = ({
  permissionAndVisibilityType,
  visibleToOrgDeployer: visibleToOrgDeployerBase,
}: {
  permissionAndVisibilityType?: PermissionAndVisibilityType;
  visibleToOrgDeployer?: boolean;
}) => {
  const { orgOnly, visibleToCustomerDeployer, visibleToOrgDeployer } =
    getPermissionAndVisibilityValues({
      permissionAndVisibilityType,
      visibleToOrgDeployer: visibleToOrgDeployerBase,
    });

  return {
    orgOnly,
    meta: {
      visibleToCustomerDeployer,
      visibleToOrgDeployer,
    },
  };
};

const convertComponentReference = (
  componentReference: ComponentReference,
  componentRegistry: ComponentRegistry,
  referenceType: Extract<
    keyof ComponentManifest,
    "actions" | "triggers" | "dataSources" | "connections"
  >,
): {
  ref: ServerComponentReference;
  inputs: Record<string, ServerInput>;
} => {
  const manifest = componentRegistry[componentReference.component];

  if (!manifest) {
    throw new Error(
      `Component with key "${componentReference.component}" not found in component registry.`,
    );
  }

  const manifestEntry = manifest[referenceType][componentReference.key];

  if (!manifestEntry) {
    throw new Error(
      `Component with key "${componentReference.component}" does not have an entry with key "${componentReference.key}" in the component registry.`,
    );
  }

  const ref: ServerComponentReference = {
    component: {
      key: manifest.key,
      signature: manifest.signature ?? "",
      isPublic: manifest.public,
    },
    // older versions of the manifest did not contain a key so we fall back to the componentReference key
    key: manifestEntry.key ?? componentReference.key,
  };

  const inputs = Object.entries(manifestEntry.inputs).reduce(
    (result, [key, manifestEntryInput]) => {
      // Retrieve the input value or default to the manifest's default value
      const value = componentReference.values?.[key] ?? {
        value: manifestEntryInput.default ?? "",
      };

      const type = manifestEntryInput.collection
        ? "complex"
        : "value" in value
          ? "value"
          : "configVar";

      if ("value" in value) {
        const valueExpr =
          manifestEntryInput.collection === "keyvaluelist" && value.value instanceof Object
            ? Object.entries(value.value).map<ServerInput>(([k, v]) => ({
                name: { type: "value", value: k },
                type: "value",
                value: JSON.stringify(v),
              }))
            : manifestEntryInput.collection === "valuelist" && Array.isArray(value.value)
              ? value.value.map((v) => ({ type: "value", value: v }))
              : value.value;

        const formattedValue =
          type === "complex" || typeof valueExpr === "string"
            ? valueExpr
            : JSON.stringify(valueExpr);

        const meta: VisibilityAndPermissionValue & { writeOnly?: true } =
          convertInputPermissionAndVisibility(
            pick(value, ["permissionAndVisibilityType", "visibleToOrgDeployer"]) as {
              permissionAndVisibilityType?: PermissionAndVisibilityType;
              visibleToOrgDeployer?: boolean;
            },
          );

        const { writeOnly } = pick(value, ["writeOnly"]) as {
          writeOnly?: true;
        };

        if (writeOnly) {
          meta.writeOnly = writeOnly;
        }

        return {
          ...result,
          [key]: { type: type, value: formattedValue, meta },
        };
      }

      if ("configVar" in value) {
        return {
          ...result,
          [key]: { type: "configVar", value: value.configVar },
        };
      }

      return result;
    },
    {},
  );

  return {
    ref,
    inputs,
  };
};

const convertComponentRegistry = (
  componentRegistry: ComponentRegistry,
  publicSupplementalComponent?: "webhook" | "schedule",
): Array<ServerComponentReference["component"]> => {
  const convertedRegistry: Array<ServerComponentReference["component"]> = Object.values(
    componentRegistry,
  ).map(({ key, public: isPublic, signature }) => ({
    key,
    signature: signature ?? "",
    isPublic,
  }));

  if (publicSupplementalComponent) {
    convertedRegistry.push({
      key: `${publicSupplementalComponent}-triggers`,
      isPublic: true,
      version: "LATEST",
    });
  }

  return convertedRegistry;
};

/**
 * Create a reference to the private component built as part of this CNI.
 *
 * References to this component always use `version: "LATEST", isPublic: false`
 * because they automatically publish alongside the corresponding CNI yml.
 * */
const codeNativeIntegrationComponentReference = (referenceKey: string) => ({
  key: referenceKey,
  version: "LATEST" as const,
  isPublic: false,
});

/* A flow's trigger gets wrapped in a custom component if there's a defined
 * onTrigger function, or if any custom onInstance behavior is defined.
 * */
const flowUsesWrapperTrigger = (
  flow: Pick<Flow, "onTrigger" | "onInstanceDelete" | "onInstanceDeploy">,
) => {
  return typeof flow.onTrigger === "function" || flow.onInstanceDelete || flow.onInstanceDeploy;
};

/** Converts a Flow into the structure necessary for YAML generation. */
export const convertFlow = (
  flow: Flow,
  componentRegistry: ComponentRegistry,
  referenceKey: string,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {
    ...flow,
  };
  result.onTrigger = undefined;
  result.trigger = undefined;
  result.onInstanceDeploy = undefined;
  result.onInstanceDelete = undefined;
  result.onExecution = undefined;
  result.preprocessFlowConfig = undefined;
  result.errorConfig = undefined;

  let publicSupplementalComponent: "webhook" | "schedule" | undefined;

  const triggerStep: Record<string, unknown> = {
    name: "On Trigger",
    stableKey: `${flow.stableKey}-onTrigger`,
    description: "The function that will be executed by the flow to return an HTTP response.",
    isTrigger: true,
    errorConfig: "errorConfig" in flow ? { ...flow.errorConfig } : undefined,
  };

  const useWrapperTrigger = flowUsesWrapperTrigger(flow);

  if (isComponentReference(flow.onTrigger) && !useWrapperTrigger) {
    const { ref, inputs } = convertComponentReference(
      flow.onTrigger,
      componentRegistry,
      "triggers",
    );
    triggerStep.action = ref;
    triggerStep.inputs = inputs;
  } else if (useWrapperTrigger) {
    if (!flow.onTrigger) {
      publicSupplementalComponent = flow.schedule ? "schedule" : "webhook";
    }

    triggerStep.action = {
      key: flowFunctionKey(flow.name, "onTrigger"),
      component: codeNativeIntegrationComponentReference(referenceKey),
    };
  } else {
    const hasSchedule = "schedule" in flow && typeof flow.schedule === "object";
    const key = hasSchedule ? "schedule" : "webhook";
    triggerStep.action = {
      key,
      component: {
        key: `${key}-triggers`,
        /**
         * TODO: Add support for specific versions of platform triggers
         */
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
    result.schedule = undefined;
  }

  const actionStep: Record<string, unknown> = {
    action: {
      key: flowFunctionKey(flow.name, "onExecution"),
      component: codeNativeIntegrationComponentReference(referenceKey),
    },
    name: "On Execution",
    stableKey: `${flow.stableKey}-onExecution`,
    description: "The function that will be executed by the flow.",
    errorConfig: "errorConfig" in flow ? { ...flow.errorConfig } : undefined,
  };

  result.steps = [triggerStep, actionStep];

  result.supplementalComponents = convertComponentRegistry(
    componentRegistry,
    publicSupplementalComponent,
  );

  return result;
};

/** Converts an input value to the expected server type by its collection type */
const convertInputValue = (value: unknown, collectionType: CollectionType | undefined) => {
  if (collectionType !== "keyvaluelist") {
    return value;
  }

  if (Array.isArray(value)) {
    return value;
  }

  return Object.entries(value as object).map<KeyValuePair>(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
};

/** Converts a Config Var into the structure necessary for YAML generation. */
export const convertConfigVar = (
  key: string,
  configVar: ConfigVar,
  referenceKey: string,
  componentRegistry: ComponentRegistry,
): ServerRequiredConfigVariable => {
  if (isConnectionScopedConfigVar(configVar)) {
    const { stableKey } = pick(configVar, ["stableKey"]);

    return {
      key,
      stableKey,
      dataType: "connection",
      orgOnly: false,
      useScopedConfigVar: stableKey,
    };
  }

  const { orgOnly, meta } = convertConfigVarPermissionAndVisibility(
    pick(configVar, ["permissionAndVisibilityType", "visibleToOrgDeployer"]),
  );

  if (isConnectionDefinitionConfigVar(configVar)) {
    const { stableKey, description } = pick(configVar, ["stableKey", "description"]);

    return {
      stableKey,
      description,
      key,
      dataType: "connection",
      connection: {
        key: camelCase(key),
        component: codeNativeIntegrationComponentReference(referenceKey),
      },
      inputs: Object.entries(configVar.inputs).reduce((result, [key, input]) => {
        if (input.shown === false) {
          return result;
        }

        const meta: VisibilityAndPermissionValue & { writeOnly?: true } =
          convertInputPermissionAndVisibility(
            pick(input, ["permissionAndVisibilityType", "visibleToOrgDeployer"]) as {
              permissionAndVisibilityType?: PermissionAndVisibilityType;
              visibleToOrgDeployer?: boolean;
            },
          );

        if (input.writeOnly) {
          meta.writeOnly = input.writeOnly;
        }

        const defaultValue = input.collection
          ? (input.default || []).map((defaultValue) => {
              if (typeof defaultValue === "string") {
                return {
                  type: "value",
                  value: defaultValue,
                };
              }

              return {
                name: defaultValue.key,
                type: "value",
                value: defaultValue.value,
              };
            })
          : input.default || "";

        return {
          ...result,
          [key]: {
            type: input.collection ? "complex" : "value",
            value: defaultValue,
            meta,
          },
        };
      }, {}),
      orgOnly,
      meta: {
        ...meta,
        ...("oauth2Config" in configVar ? configVar.oauth2Config ?? {} : {}),
      },
    };
  }

  if (isConnectionReferenceConfigVar(configVar)) {
    const { ref, inputs } = convertComponentReference(
      configVar.connection,
      componentRegistry,
      "connections",
    );

    const {
      stableKey = "",
      description,
      connection: { template, onPremiseConnectionConfig },
    } = pick(configVar, ["stableKey", "description", "connection"]);

    return {
      stableKey,
      description,
      key,
      dataType: "connection",
      onPremiseConnectionConfig,
      connection: {
        ...ref,
        template,
      },
      inputs,
      orgOnly,
      meta: {
        ...meta,
        ...("oauth2Config" in configVar ? configVar.oauth2Config ?? {} : {}),
      },
    };
  }

  const rawDefaultValue =
    "defaultValue" in configVar
      ? convertInputValue(configVar.defaultValue, configVar.collectionType)
      : undefined;

  const defaultValue =
    typeof rawDefaultValue !== "undefined"
      ? typeof rawDefaultValue === "string"
        ? rawDefaultValue
        : JSON.stringify(rawDefaultValue)
      : undefined;

  const result = assign(
    { orgOnly, meta, key, defaultValue },
    pick(configVar, [
      "stableKey",
      "description",
      "dataType",
      "pickList",
      "timeZone",
      "codeLanguage",
      "collectionType",
    ]),
  ) as ServerDefaultRequiredConfigVariable;

  if (isScheduleConfigVar(configVar)) {
    result.scheduleType = "custom";
  }

  if (isJsonFormConfigVar(configVar) || isJsonFormDataSourceConfigVar(configVar)) {
    result.meta = {
      ...result.meta,
      validationMode: configVar?.validationMode ?? "ValidateAndShow",
    };
  }

  if (isDataSourceDefinitionConfigVar(configVar)) {
    result.dataType = configVar.dataSourceType;
    result.dataSource = {
      key: camelCase(key),
      component: codeNativeIntegrationComponentReference(referenceKey),
    };
  }

  if (isDataSourceReferenceConfigVar(configVar)) {
    const { ref, inputs } = convertComponentReference(
      configVar.dataSource,
      componentRegistry,
      "dataSources",
    );
    result.dataType = componentRegistry[ref.component.key].dataSources[ref.key].dataSourceType;
    result.dataSource = ref;
    result.inputs = inputs;

    if (configVar.validationMode) {
      result.meta = {
        ...result.meta,
        validationMode: configVar.validationMode,
      };
    }
  }

  return result;
};

/** Maps the step name field to a fully qualified input. */
const fieldNameToReferenceInput = (
  stepName: string,
  fieldName: string | null | undefined,
): ServerInput | undefined =>
  fieldName ? { type: "reference", value: `${stepName}.results.${fieldName}` } : undefined;

/** Actions and Triggers will be scoped to their flow by combining the flow
 *  name and the function name. This is to ensure that the keys are unique
 *  on the resulting object, which will be turned into a Component. */
const flowFunctionKey = (flowName: string, functionName: "onExecution" | "onTrigger"): string => {
  const flowKey = flowName
    .replace(/[^0-9a-zA-Z]+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");

  return `${flowKey}_${functionName}`;
};

/* Generates component argument for invokeTrigger calls */
const invokeTriggerComponentInput = (
  componentRef: ServerComponentReference,
  onTrigger: TriggerReference | undefined,
  eventName: "perform" | "onInstanceDeploy" | "onInstanceDelete",
) => {
  const { component } = componentRef;
  const inputComponent =
    "signature" in componentRef.component
      ? {
          key: component.key,
          signature:
            "signature" in component &&
            component.signature !== null &&
            component.signature !== void 0
              ? component.signature
              : "",
          isPublic: component.isPublic,
        }
      : component;
  return {
    component: inputComponent,
    key: onTrigger ? onTrigger.key : componentRef.key,
    triggerEventFunctionName: eventName,
  };
};

/* Generates a wrapper function that calls an existing component trigger's perform */
const generateTriggerPerformFn = (
  componentRef: ServerComponentReference | undefined,
  onTrigger: TriggerReference | TriggerPerformFunction | undefined,
): TriggerPerformFunction => {
  const performFn: TriggerPerformFunction =
    componentRef && typeof onTrigger !== "function"
      ? async (context, payload, params) => {
          // @ts-expect-error: _components isn't part of the public API
          const { _components } = context;
          const invokeTrigger: TriggerActionInvokeFunction = _components.invokeTrigger;

          return await invokeTrigger(
            invokeTriggerComponentInput(componentRef, onTrigger, "perform"),
            context,
            payload,
            params,
          );
        }
      : (onTrigger as TriggerPerformFunction);

  return performFn;
};

type TriggerActionInvokeFunction = (
  ref: {
    component: ServerComponentReference["component"];
    key: string;
    triggerEventFunctionName: "perform" | "onInstanceDeploy" | "onInstanceDelete";
  },
  context: ActionContext,
  payload: TriggerPayload | null,
  params: Record<string, unknown>,
) => Promise<TriggerResult>;

/** Generates a wrapper function that calls an existing component's onInstanceDeploy
 * or onInstanceDelete, then calls the flow-defined version if it exists.
 * Returns the deep-merged results of the two, prioritizing the custom response
 * if there's a conflict. */
const generateOnInstanceWrapperFn = (
  componentRef: ServerComponentReference | undefined,
  onTrigger: TriggerReference | TriggerPerformFunction | undefined,
  eventName: "onInstanceDeploy" | "onInstanceDelete",
  customFn?: TriggerEventFunction,
): TriggerEventFunction | undefined => {
  const onInstanceFn: TriggerEventFunction | undefined =
    componentRef && typeof onTrigger !== "function"
      ? async (context, params) => {
          // @ts-expect-error: _components isn't part of the public API
          const { _components } = context;
          const invokeTrigger: TriggerActionInvokeFunction = _components.invokeTrigger;

          const invokeResponse =
            (await invokeTrigger(
              invokeTriggerComponentInput(componentRef, onTrigger, eventName),
              context,
              null,
              params,
            )) || {};

          let customResponse: TriggerEventFunctionReturn = {};

          if (customFn) {
            customResponse = (await customFn(context, params)) || {};
          }

          return merge(invokeResponse, customResponse);
        }
      : customFn;

  return onInstanceFn;
};

type ComponentActionInvokeFunction = <TValues extends Record<string, any>>(
  ref: ServerComponentReference,
  context: ActionContext,
  values: TValues,
) => Promise<unknown>;

type ComponentMethods = Record<string, Record<string, ComponentManifestAction["perform"]>>;

const convertOnExecution =
  (
    onExecution: ActionPerformFunction,
    componentRegistry: ComponentRegistry,
  ): ServerActionPerformFunction =>
  async (context, params) => {
    // @ts-expect-error _components isn't part of the public API
    const { _components } = context;

    const invoke = (_components as { invoke: ComponentActionInvokeFunction }).invoke;

    // Construct the component methods from the component registry
    const componentMethods = Object.entries(componentRegistry).reduce<ComponentMethods>(
      (
        accumulator,
        [registryComponentKey, { key: componentKey, actions, public: isPublic, signature }],
      ) => {
        const componentActions = Object.entries(actions).reduce<
          Record<string, ComponentManifestAction["perform"]>
        >((actionsAccumulator, [registryActionKey, action]) => {
          const manifestActions =
            componentRegistry[registryComponentKey].actions[registryActionKey];

          // Define the method to be called for the action
          const invokeAction: ComponentManifestAction["perform"] = async (values) => {
            // Apply defaults directly within the transformation process
            const transformedValues = Object.entries(manifestActions.inputs).reduce<
              Record<string, any>
            >((transformedAccumulator, [inputKey, inputValueBase]) => {
              const inputValue = values[inputKey] ?? inputValueBase.default;

              const { collection } = inputValueBase;

              return {
                ...transformedAccumulator,
                [inputKey]: convertInputValue(inputValue, collection),
              };
            }, {});

            // Invoke the action with the transformed values
            return invoke(
              {
                component: {
                  key: componentKey,
                  signature: signature ?? "",
                  isPublic,
                },
                // older versions of manifests did not contain action.key so we fall back to the registry key
                key: action.key ?? registryActionKey,
              },
              context,
              transformedValues,
            );
          };
          return {
            ...actionsAccumulator,
            [registryActionKey]: invokeAction,
          };
        }, {});

        return {
          ...accumulator,
          [registryComponentKey]: componentActions,
        };
      },
      {},
    );

    const actionContext = {
      ...context,
      debug: createDebugContext(context),
      components: componentMethods,
      invokeFlow: createInvokeFlow(context, { isCNI: true }),
    };

    const result = await onExecution(actionContext, params);

    logDebugResults(actionContext);

    return result;
  };

/** Creates the structure necessary to import a Component as part of a
 *  Code Native integration. */
const codeNativeIntegrationComponent = (
  { name, iconPath, description, flows = [], componentRegistry = {} }: IntegrationDefinition,
  referenceKey: string,
  configVars: Record<string, ConfigVar>,
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
            componentRegistry,
          ),
          inputs: [],
        },
      };
    },
    {},
  );

  const convertedTriggers = flows.reduce<Record<string, ServerTrigger>>(
    (result, { name, onTrigger, onInstanceDeploy, onInstanceDelete, schedule }) => {
      if (
        !flowUsesWrapperTrigger({
          onTrigger,
          onInstanceDelete,
          onInstanceDeploy,
        })
      ) {
        // In this scenario, the user has defined an existing component trigger
        // without any custom behavior, so we don't need to wrap anything.
        return result;
      }

      const key = flowFunctionKey(name, "onTrigger");
      const defaultComponentKey = schedule && typeof schedule === "object" ? "schedule" : "webhook";
      const defaultComponentRef: ServerComponentReference = {
        component: {
          key: `${defaultComponentKey}-triggers`,
          version: "LATEST",
          isPublic: true,
        },
        key: defaultComponentKey,
      };

      // The component ref here is undefined if onTrigger is a function.
      const { ref } = isComponentReference(onTrigger)
        ? convertComponentReference(onTrigger as TriggerReference, componentRegistry, "triggers")
        : { ref: onTrigger ? undefined : defaultComponentRef };

      const performFn: TriggerPerformFunction = generateTriggerPerformFn(ref, onTrigger);
      const deleteFn: TriggerEventFunction | undefined = generateOnInstanceWrapperFn(
        ref,
        onTrigger,
        "onInstanceDelete",
        onInstanceDelete,
      );
      const deployFn: TriggerEventFunction | undefined = generateOnInstanceWrapperFn(
        ref,
        onTrigger,
        "onInstanceDeploy",
        onInstanceDeploy,
      );

      return {
        ...result,
        [key]: {
          key,
          display: {
            label: `${name} - onTrigger`,
            description:
              "The function that will be executed by the flow to return an HTTP response.",
          },
          perform: performFn,
          onInstanceDeploy: deployFn,
          hasOnInstanceDeploy: !!deployFn,
          onInstanceDelete: deleteFn,
          hasOnInstanceDelete: !!deleteFn,
          inputs: [],
          scheduleSupport: "valid",
          synchronousResponseSupport: "valid",
        },
      };
    },
    {},
  );

  const convertedDataSources = Object.entries(configVars).reduce<Record<string, ServerDataSource>>(
    (result, [key, configVar]) => {
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
    },
    {},
  );

  const convertedConnections = Object.entries(configVars).reduce<ServerConnection[]>(
    (result, [key, configVar]) => {
      if (!isConnectionDefinitionConfigVar(configVar)) {
        return result;
      }

      const convertedInputs = Object.entries(configVar.inputs).map(([key, value]) =>
        convertInput(key, value),
      );

      const connection = pick(configVar, ["oauth2Type", "oauth2PkceMethod"]);
      const { avatarPath: avatarIconPath, oauth2ConnectionIconPath: iconPath } =
        configVar.icons ?? {};

      return [
        ...result,
        {
          ...connection,
          iconPath,
          avatarIconPath,
          inputs: convertedInputs,
          key: camelCase(key),
          label: key,
        },
      ];
    },
    [],
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
