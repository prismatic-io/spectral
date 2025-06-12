import { memoryUsage } from "node:process";
import { ActionContext as ServerActionContext } from ".";
import {
  ActionContext,
  ComponentManifestAction,
  ComponentRegistry,
  DebugContext,
  ExecutionFrame,
  FlowInvoker,
  MemoryUsage,
} from "../types";
import { performance } from "node:perf_hooks";
import { ComponentReference as ServerComponentReference } from "./integration";
import { convertInputValue } from "./convertIntegration";
import axios, { AxiosRequestConfig } from "axios";

const MEMORY_USAGE_CONVERSION = 1024 * 1024;

type ComponentActionInvokeFunction = <TValues extends Record<string, any>>(
  ref: ServerComponentReference,
  context: ActionContext,
  values: TValues,
) => Promise<unknown>;

type ComponentMethods = Record<string, Record<string, ComponentManifestAction["perform"]>>;

export function createCNIContext(
  context: ActionContext,
  componentRegistry: ComponentRegistry,
): ActionContext {
  // Component, debug, and invokeFlow methods are not provided as part of the server context.
  // They are added to the context via spectral, here.

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
        const manifestActions = componentRegistry[registryComponentKey].actions[registryActionKey];

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
            {
              ...context,
              debug: createDebugContext(context),
            },
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

  return {
    ...context,
    debug: createDebugContext(context),
    components: componentMethods,
    invokeFlow: createInvokeFlow(context, { isCNI: true }),
  };
}

export function createDebugContext(context: ServerActionContext): DebugContext {
  const globalDebug = Boolean(context.globalDebug);

  return {
    enabled: globalDebug,
    timeElapsed: {
      mark: (actionContext: ActionContext, label: string) => {
        if (globalDebug) {
          actionContext.debug.results.timeElapsed.marks[label] = performance.now();
        }
      },
      measure: (
        actionContext: ActionContext,
        label: string,
        marks: { start: string; end: string },
      ) => {
        if (globalDebug) {
          actionContext.debug.results.timeElapsed.measurements[label] = {
            marks,
            duration:
              actionContext.debug.results.timeElapsed.marks[marks.end] -
              actionContext.debug.results.timeElapsed.marks[marks.start],
          };
        }
      },
    },
    memoryUsage: (actionContext: ActionContext, label: string, showDetail?: boolean) => {
      if (globalDebug) {
        const usage = showDetail
          ? memoryUsageInMB()
          : // @ts-expect-error: memoryUsage.rss() is documented but not typed
            (memoryUsage.rss() as number) / MEMORY_USAGE_CONVERSION;

        actionContext.debug.results.memoryUsage.push({
          mark: label,
          rss: typeof usage === "number" ? usage : usage.rss,
          detail: typeof usage === "number" ? undefined : usage,
        });
      }
    },
    results: {
      timeElapsed: { marks: {}, measurements: {} },
      memoryUsage: [],
      allowedMemory: Number(context.runnerAllocatedMemoryMb),
    },
  };
}

export function logDebugResults(context: ActionContext) {
  if (context.debug.enabled) {
    context.logger.metric(context.debug.results);
  }
}

function memoryUsageInMB() {
  const usage: MemoryUsage = memoryUsage();
  return Object.keys(usage).reduce<MemoryUsage>(
    (accum, key) => {
      accum[key as keyof MemoryUsage] = usage[key as keyof MemoryUsage] / MEMORY_USAGE_CONVERSION;
      return accum;
    },
    {
      rss: -1,
      heapTotal: -1,
      heapUsed: -1,
      external: -1,
      arrayBuffers: -1,
    },
  );
}

function formatExecutionFrameHeaders(frame: ExecutionFrame, source?: string) {
  let frameToUse = frame;

  if (source) {
    frameToUse = {
      ...frame,
      customSource: source,
    };
  }

  return JSON.stringify(frameToUse);
}

export const createInvokeFlow = <const TFlows extends Readonly<string[]>>(
  context: ActionContext,
  options: { isCNI?: boolean } = {},
): FlowInvoker<TFlows> => {
  return async (
    flowName: TFlows[number],
    data?: Record<string, unknown>,
    config?: AxiosRequestConfig,
    source?: string,
  ) => {
    const sourceToUse = options.isCNI ? source : undefined;
    return await axios.post(context.webhookUrls[flowName], data, {
      ...config,
      headers: {
        ...(config?.headers ?? {}),
        ...(context.webhookApiKeys[flowName]?.length > 0
          ? {
              "Api-Key": context.webhookApiKeys[flowName][0],
            }
          : {}),
        "prismatic-invoked-by": formatExecutionFrameHeaders(context.executionFrame, sourceToUse),
        "prismatic-invoke-type": "Cross Flow",
        "prismatic-executionid": context.executionId,
      },
    });
  };
};
