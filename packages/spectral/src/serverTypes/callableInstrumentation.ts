import mapValues from "lodash/mapValues";
import { requireContext, requireDataSourceContext } from "./asyncContext";
import { getCallableMockTarget, identifyCallable, mockable } from "./callableMock";

type Callable = (...args: any[]) => any;
type ResolverCalls = { resolveItems?: Callable; getNextPaginationState?: Callable };
interface TriggerCalls {
  perform: Callable;
  onDeployPerform?: Callable;
  onInstanceDeploy?: Callable;
  onInstanceDelete?: Callable;
  webhookLifecycleHandlers?: { create: Callable; delete: Callable };
  triggerResolver?: ResolverCalls;
  onDeployResolver?: ResolverCalls;
}

/** Decorates freshly built execution methods; original component definitions stay untouched. */
export const instrumentEntityCalls = <T extends Record<string, Callable>>(
  calls: T,
  owner: object,
  entities: Record<string, { examplePayload?: unknown }>,
  kind: "actions" | "dataSources",
): T =>
  mapValues(calls, (call, key) =>
    mockable(
      call,
      { owner, method: `${kind}.${key}.perform`, examplePayload: entities[key]?.examplePayload },
      kind === "actions" ? requireContext : requireDataSourceContext,
    ),
  ) as T;

/**
 * Instrument only the known execution surface, before binding factories capture its methods.
 * This mutates the fresh calls table, never the source definition or the factory itself.
 */
export const instrumentTriggerCalls = <T extends TriggerCalls>(
  calls: T,
  owner: object,
  key: string,
  examplePayload: unknown,
): T => {
  const wrap = <F extends Callable>(call: F, method: string, examplePayload?: unknown): F =>
    mockable(call, { owner, method: `triggers.${key}.${method}`, examplePayload }, requireContext);

  calls.perform = wrap(calls.perform, "perform", examplePayload);
  for (const method of ["onDeployPerform", "onInstanceDeploy", "onInstanceDelete"] as const) {
    const call = calls[method];
    if (call) calls[method] = wrap(call, method);
  }

  if (calls.webhookLifecycleHandlers) {
    for (const method of ["create", "delete"] as const) {
      calls.webhookLifecycleHandlers[method] = wrap(
        calls.webhookLifecycleHandlers[method],
        `webhookLifecycleHandlers.${method}`,
      );
    }
  }

  for (const group of ["triggerResolver", "onDeployResolver"] as const) {
    const resolver = calls[group];
    if (!resolver) continue;
    for (const method of ["resolveItems", "getNextPaginationState"] as const) {
      const call = resolver[method];
      if (call) resolver[method] = wrap(call, `${group}.${method}`);
    }
  }

  return calls;
};

/** The overloaded data-source factory shares its execution identity, but remains a real factory. */
export const identifyDataSourceAlias = <T extends object>(alias: T, perform: Callable): T => {
  const target = getCallableMockTarget(perform);
  if (!target) throw new Error("Data-source execution must be instrumented before its alias.");

  return identifyCallable(alias, target);
};
