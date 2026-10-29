import merge from "lodash/merge";
import type { ComponentDefinition, TriggerDefinition } from "../types";

type ComponentTrigger = NonNullable<ComponentDefinition<boolean, string>["triggers"]>[string];

/** Definition-time bindings stay local to the CNI and never become component references. */
export const boundTriggerSymbol: unique symbol = Symbol.for(
  "@prismatic-io/spectral/bound-trigger/v1",
);
const normalizedFlowSymbol = Symbol("normalizedBoundTriggerFlow");

export interface BoundTrigger {
  definition: ComponentTrigger;
  bindings: Record<string, unknown>;
  /** Execution adapters preserve callable interception for discovery callbacks. */
  triggerResolver?: TriggerDefinition["triggerResolver"];
  onDeployResolver?: TriggerDefinition["onDeployResolver"];
  onInstanceDeploy?: ComponentTrigger["onInstanceDeploy"];
  onInstanceDelete?: ComponentTrigger["onInstanceDelete"];
  webhookLifecycleHandlers?: TriggerDefinition["webhookLifecycleHandlers"];
  onDeployTrigger?: ComponentTrigger["onDeployPerform"];
}

export const getBoundTrigger = (value: unknown): BoundTrigger | undefined =>
  typeof value === "function"
    ? (value as unknown as { [boundTriggerSymbol]?: BoundTrigger })[boundTriggerSymbol]
    : undefined;

const composeEvent = (
  componentEvent: ComponentTrigger["onInstanceDeploy"],
  flowEvent: ComponentTrigger["onInstanceDeploy"],
): ComponentTrigger["onInstanceDeploy"] =>
  componentEvent && flowEvent
    ? async (context, params) =>
        merge(
          {},
          (await componentEvent(context, params)) ?? {},
          (await flowEvent(context, params)) ?? {},
        )
    : (componentEvent ?? flowEvent);

/** Expand local trigger behavior once, before the ordinary CNI conversion. */
export const normalizeBoundTrigger = <
  TFlow extends {
    onTrigger?: unknown;
    onInstanceDeploy?: ComponentTrigger["onInstanceDeploy"];
    onInstanceDelete?: ComponentTrigger["onInstanceDelete"];
    webhookLifecycleHandlers?: TriggerDefinition["webhookLifecycleHandlers"];
    onDeployTrigger?: ComponentTrigger["onDeployPerform"];
    runInitialSyncOnDeploy?: boolean;
  },
>(
  flow: TFlow,
): TFlow => {
  const bound = getBoundTrigger(flow.onTrigger);
  if (!bound || normalizedFlowSymbol in flow) return flow;
  const { definition } = bound;
  if (flow.runInitialSyncOnDeploy && !definition.triggerResolver) {
    throw new Error(
      "Initial sync for a bundled trigger requires a triggerResolver to enable batching on the platform.",
    );
  }
  const webhook = bound.webhookLifecycleHandlers;
  const normalized = {
    ...flow,
    onInstanceDeploy: composeEvent(bound.onInstanceDeploy, flow.onInstanceDeploy),
    onInstanceDelete: composeEvent(bound.onInstanceDelete, flow.onInstanceDelete),
    ...(webhook
      ? {
          webhookLifecycleHandlers: {
            create: composeEvent(webhook.create, flow.webhookLifecycleHandlers?.create),
            delete: composeEvent(webhook.delete, flow.webhookLifecycleHandlers?.delete),
          },
        }
      : {}),
    ...("triggerType" in definition ? { triggerType: definition.triggerType } : {}),
    ...(definition.batchConfig ? { batchConfig: definition.batchConfig } : {}),
    ...(definition.triggerResolver ? { triggerResolver: definition.triggerResolver } : {}),
    ...(bound.onDeployTrigger && !flow.onDeployTrigger
      ? {
          onDeployTrigger: bound.onDeployTrigger,
          runInitialSyncOnDeploy: flow.runInitialSyncOnDeploy ?? false,
          ...(definition.onDeployResolver ? { onDeployResolver: definition.onDeployResolver } : {}),
        }
      : {}),
  };
  Object.defineProperty(normalized, normalizedFlowSymbol, { value: true });
  return normalized as TFlow;
};
