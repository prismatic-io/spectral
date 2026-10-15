import { describe, expect, it, vi } from "vitest";
import { authoringSymbol, callableComponent, retainAuthoring } from "./callableComponent";
import { action, component, dynamicObjectInput, input, structuredObjectInput } from "./index";
import { runWithContext } from "./serverTypes/asyncContext";
import type { ActionContext } from "./types";

const display = { label: "Example", description: "Example action" };
const createActionContext = () => ({ invokeFlow: vi.fn() }) as unknown as ActionContext;

describe("callableComponent", () => {
  it("retains authoring data outside the enumerable platform surface", () => {
    const authored = { actions: {} };
    const server = { key: "example", actions: {} };
    const before = JSON.stringify(server);
    const retained = retainAuthoring(server, authored);

    expect(retained).toBe(server);
    expect(retained[authoringSymbol]).toBe(authored);
    expect(Object.keys(retained)).toEqual(["key", "actions"]);
    expect(JSON.stringify(retained)).toBe(before);
    expect(callableComponent(retained)).toEqual({
      actions: {},
      dataSources: {},
      triggers: {},
      connections: {},
    });
  });

  it("rejects converted actions when copying the component loses its authoring carrier", () => {
    const authored = component({
      key: "example",
      public: false,
      display: { ...display, iconPath: "icon.png" },
      actions: { run: action({ display, inputs: {}, perform: async () => ({ data: true }) }) },
    });
    expect(() => callableComponent({ ...authored })).toThrow("spreading or serializing");
  });

  it("applies defaults before cleaning once and preserves the current context and result", async () => {
    const clean = vi.fn((value: unknown) => ({ parsed: String(value) }));
    const context = createActionContext();
    const perform = vi.fn(async (receivedContext, params) => {
      expect(receivedContext).toBe(context);
      expect(receivedContext.invokeFlow).toBe(context.invokeFlow);
      return { data: params, instanceState: { count: 1 }, branch: "done" };
    });
    const callable = callableComponent({
      actions: {
        list: action({
          display,
          inputs: {
            query: input({ type: "string", label: "Query", default: "default", clean }),
            count: input({ type: "number", label: "Count", default: "7" }),
            tags: input({ type: "string", label: "Tags", collection: "valuelist" }),
          },
          perform,
        }),
      },
    });

    expect(await runWithContext(context, () => callable.actions.list())).toEqual({
      data: { query: { parsed: "default" }, count: 7, tags: [] },
      instanceState: { count: 1 },
      branch: "done",
    });
    expect(clean).toHaveBeenCalledExactlyOnceWith("default");
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it("prepares nested defaults and cleans structured and dynamic values", async () => {
    const amount = input({ type: "number", label: "Amount", default: "4" });
    const clean = vi.fn((value: unknown) => ({ parsed: String(value) }));
    const callable = callableComponent({
      actions: {
        run: action({
          display,
          inputs: {
            omitted: structuredObjectInput({ label: "Omitted", inputs: { amount } }),
            groups: structuredObjectInput({
              label: "Groups",
              collection: "keyvaluelist",
              inputs: { amount },
            }),
            choice: dynamicObjectInput({
              label: "Choice",
              configurations: {
                selected: {
                  label: "Selected",
                  inputs: {
                    name: input({ type: "string", label: "Name", default: "nested", clean }),
                    amount,
                  },
                },
              },
            }),
          },
          perform: async (_context, params) => ({ data: params }),
        }),
      },
    });

    const result = await runWithContext(createActionContext(), () =>
      callable.actions.run({
        groups: { a: {} },
        choice: { configuration: "selected", values: {} },
      }),
    );
    expect(result).toEqual({
      data: {
        omitted: { amount: 4 },
        groups: [{ key: "a", value: { amount: 4 } }],
        choice: { configuration: "selected", values: { name: { parsed: "nested" }, amount: 4 } },
      },
    });
    expect(clean).toHaveBeenCalledExactlyOnceWith("nested");
  });

  it("does not share mutable defaults between calls", async () => {
    const initial = ["first"];
    const callable = callableComponent({
      actions: {
        run: action({
          display,
          inputs: {
            tags: input({
              type: "string",
              label: "Tags",
              collection: "valuelist",
              default: initial,
              clean: (value: unknown) => {
                const values = value as string[];
                values.push("next");
                return values;
              },
            }),
          },
          perform: async (_context, params) => ({ data: params.tags }),
        }),
      },
    });
    await runWithContext(createActionContext(), async () => {
      expect(await callable.actions.run({})).toEqual({ data: ["first", "next"] });
      expect(await callable.actions.run({})).toEqual({ data: ["first", "next"] });
    });
    expect(initial).toEqual(["first"]);
  });

  it("preserves explicit null for cleaners and normalizes primitive keyed collections", async () => {
    const clean = vi.fn((value: unknown) => value);
    const callable = callableComponent({
      actions: {
        run: action({
          display,
          inputs: {
            value: input({ type: "data", label: "Value", default: "fallback", clean }),
            counts: input({ type: "number", label: "Counts", collection: "keyvaluelist" }),
          },
          perform: async (_context, params) => ({ data: params }),
        }),
      },
    });
    expect(
      await runWithContext(createActionContext(), () =>
        callable.actions.run({ value: null, counts: { first: 2, next: "3" } }),
      ),
    ).toEqual({
      data: {
        value: null,
        counts: [
          { key: "first", value: 2 },
          { key: "next", value: 3 },
        ],
      },
    });
    expect(clean).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("serializes native booleans only when the author did not provide a cleaner", async () => {
    const clean = vi.fn((value: unknown) => value);
    const callable = callableComponent({
      actions: {
        run: action({
          display,
          inputs: {
            enabled: input({ type: "boolean", label: "Enabled", default: "false" }),
            flags: input({ type: "boolean", label: "Flags", collection: "valuelist" }),
            keyedFlags: input({
              type: "boolean",
              label: "Keyed Flags",
              collection: "keyvaluelist",
            }),
            cleaned: input({ type: "boolean", label: "Cleaned", clean }),
          },
          perform: async (_context, params) => ({
            data: { ...params, enabled: params.enabled.toUpperCase() },
          }),
        }),
      },
    });
    const result = await runWithContext(createActionContext(), () =>
      callable.actions.run({
        enabled: true,
        flags: [false, "true"],
        keyedFlags: { first: false, second: "true" },
        cleaned: false,
      }),
    );
    expect(result).toEqual({
      data: {
        enabled: "TRUE",
        flags: ["false", "true"],
        keyedFlags: [
          { key: "first", value: "false" },
          { key: "second", value: "true" },
        ],
        cleaned: false,
      },
    });
    expect(clean).toHaveBeenCalledExactlyOnceWith(false);
  });

  it.each(["clean", "perform"])("runs the error hook once for a %s error", async (stage) => {
    const failure = new Error(stage);
    const handled = new Error("handled");
    const error = vi.fn(async () => handled);
    const callable = callableComponent({
      hooks: { error },
      actions: {
        run: action({
          display,
          inputs: {
            value: input({
              type: "string",
              label: "Value",
              clean: () => {
                if (stage === "clean") throw failure;
                return "cleaned";
              },
            }),
          },
          perform: async () => {
            throw failure;
          },
        }),
      },
    });
    await expect(
      runWithContext(createActionContext(), () => callable.actions.run({})),
    ).rejects.toBe(handled);
    expect(error).toHaveBeenCalledExactlyOnceWith(failure);
  });

  it("fails clearly outside a CNI context", async () => {
    const callable = callableComponent({
      actions: { run: action({ display, inputs: {}, perform: async () => ({ data: "ok" }) }) },
    });
    await expect(callable.actions.run({})).rejects.toThrow("ActionContext not found");
  });
});
