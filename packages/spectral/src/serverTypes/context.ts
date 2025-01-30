import { memoryUsage } from "node:process";
import { ActionContext as ServerActionContext } from ".";
import { ActionContext, DebugContext } from "../types";
import { performance } from "node:perf_hooks";

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
        // @ts-expect-error: memoryUsage.rss() is documented but not typed
        const usage = showDetail ? memoryUsage() : (memoryUsage.rss() as number);

        actionContext.debug.results.memoryUsage.push({
          mark: label,
          rss: typeof usage === "number" ? usage / 1000000 : usage.rss / 1000000,
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
