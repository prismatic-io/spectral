import { describe, expect, it, vi } from "vitest";

describe("ambient context storage sharing across module instances", () => {
  it("lets a second, independently-loaded copy of this module see context set by the first", async () => {
    // Simulates what happens when a component's own bundler ships its own copy of
    // spectral: two distinct module instances of asyncContext.ts in the same process.
    // Without the globalThis/Symbol.for registry, each would get its own
    // AsyncLocalStorage and this would fail with "ActionContext not found".
    vi.resetModules();
    const first = await import("./asyncContext");

    vi.resetModules();
    const second = await import("./asyncContext");

    expect(second).not.toBe(first);

    const context = { id: "shared-context" } as any;

    const result = await first.runWithContext(context, () => second.requireContext());

    expect(result).toBe(context);
  });
});
