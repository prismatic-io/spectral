import { memoryUsage } from "node:process";
import { ActionContext as ServerActionContext } from ".";
import { ActionContext, DebugContext, MemoryUsage } from "../types";
import { performance } from "node:perf_hooks";

const MEMORY_USAGE_CONVERSION = 1024 * 1024;

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
