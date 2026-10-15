import { describe, expect, it } from "vitest";
import { action, component, dynamicObjectInput, input, structuredObjectInput } from "..";
import { ConnectionError, isUserError, UserError } from "../errors";
import { runWithContext } from "./asyncContext";
import { createCallableComponent } from "./callableAction";

const rawEcho = component({
  key: "echo",
  public: true,
  display: { label: "Echo", description: "Echoes things back." },
  actions: {
    sayHello: action({
      display: { label: "Say Hello", description: "Says hello." },
      inputs: {
        name: input({ type: "string", label: "Name", default: "World" }),
      },
      perform: async (_context, { name }) => ({ data: `Hello, ${name}!` }),
    }),
    bareReturn: action({
      display: { label: "Bare Return", description: "Returns a bare value." },
      inputs: {},
      perform: async () => "just a string" as any,
    }),
    blowUp: action({
      display: { label: "Blow Up", description: "Always throws." },
      inputs: { connection: input({ type: "connection", label: "Connection" }) },
      perform: async (_context, { connection }) => {
        throw new ConnectionError(connection as any, "bad credentials");
      },
    }),
    blowUpPlain: action({
      display: { label: "Blow Up Plain", description: "Always throws a plain error." },
      inputs: {},
      perform: async () => {
        throw new Error("boom");
      },
    }),
  },
});

describe("component()", () => {
  it("keeps every converted property the platform reads, on the callable entry itself", () => {
    // prism components:publish spreads each action into its payload, the runner
    // destructures `perform`/`examplePerform` off it, manifest generation reads
    // `key`/`inputs`/`display`. All of those must stay on the entry.
    const { sayHello } = rawEcho.actions;
    expect(typeof sayHello).toBe("function");
    expect(typeof sayHello.perform).toBe("function");
    expect(sayHello.key).toBe("sayHello");
    expect(sayHello.display).toEqual({ label: "Say Hello", description: "Says hello." });
    expect(sayHello.inputs.map((input) => input.key)).toEqual(["name"]);
    expect(Object.keys({ ...sayHello })).toEqual(
      expect.arrayContaining(["key", "display", "inputs", "perform"]),
    );
  });

  it("keeps connections an array, as prism components:publish sends it", () => {
    expect(Array.isArray(rawEcho.connections)).toBe(true);
    expect(JSON.parse(JSON.stringify(rawEcho.connections))).toEqual([]);
  });
});

describe("component(definition) callable surface", () => {
  const echoDefinition = {
    key: "echo",
    public: true as const,
    display: { label: "Echo", description: "Echoes things back." },
    actions: {
      sayHello: action({
        display: { label: "Say Hello", description: "Says hello." },
        inputs: { name: input({ type: "string", label: "Name", default: "World" }) },
        perform: async (_context: any, { name }: any) => ({ data: `Hello, ${name}!` }),
      }),
    },
  };

  it("makes each action directly callable", async () => {
    const built = component(echoDefinition);

    expect(typeof built.actions.sayHello).toBe("function");

    const result = await runWithContext({} as any, () => built.actions.sayHello({ name: "Pat" }));
    expect(result).toEqual({ data: "Hello, Pat!" });
  });

  it("is idempotent: wrapping an already-built component changes nothing", async () => {
    const built = component(echoDefinition);
    const rewrapped = createCallableComponent(built);

    const result = await runWithContext({} as any, () =>
      rewrapped.actions.sayHello({ name: "Pat" }),
    );
    expect(result).toEqual({ data: "Hello, Pat!" });
    expect(typeof rewrapped.actions.sayHello.perform).toBe("function");
  });
});

describe("createCallableComponent", () => {
  const echo = createCallableComponent(rawEcho);

  it("is invokable directly, with no context argument, inside runWithContext", async () => {
    const result = await runWithContext({} as any, () => echo.actions.sayHello({ name: "Pat" }));

    expect(result).toEqual({ data: "Hello, Pat!" });
  });

  it("fills input defaults the same way the registry path used to", async () => {
    const result = await runWithContext({} as any, () => echo.actions.sayHello({}));

    expect(result).toEqual({ data: "Hello, World!" });
  });

  it("fills an omitted structuredObject input with an object of its children's defaults", async () => {
    const paged = component({
      key: "paged",
      public: true,
      display: { label: "Paged", description: "x" },
      actions: {
        list: action({
          display: { label: "List", description: "x" },
          inputs: {
            query: input({ type: "string", label: "Query", required: false }),
            pagination: structuredObjectInput({
              label: "Pagination",
              required: false,
              inputs: {
                pageSize: input({ type: "string", label: "Page Size", default: "10" }),
                pageToken: input({ type: "string", label: "Page Token" }),
              },
            }),
          },
          // Destructures the container the way a component's perform would.
          perform: async (_context, { query, pagination: { pageSize, pageToken } }) => ({
            data: { query, pageSize, pageToken },
          }),
        }),
      },
    });

    const result = await runWithContext({} as any, () => paged.actions.list({}));

    expect(result).toEqual({ data: { query: "", pageSize: "10", pageToken: "" } });
  });

  it("fills the missing children of a partially supplied structuredObject input", async () => {
    const paged = component({
      key: "paged-partial",
      public: true,
      display: { label: "Paged", description: "x" },
      actions: {
        list: action({
          display: { label: "List", description: "x" },
          inputs: {
            pagination: structuredObjectInput({
              label: "Pagination",
              required: false,
              inputs: {
                pageSize: input({ type: "string", label: "Page Size", default: "10" }),
                pageToken: input({ type: "string", label: "Page Token", required: false }),
              },
            }),
            filters: structuredObjectInput({
              label: "Filters",
              collection: "valuelist",
              inputs: {
                field: input({ type: "string", label: "Field" }),
                op: input({ type: "string", label: "Op", default: "eq" }),
              },
            }),
          },
          perform: async (_context, { pagination, filters }) => ({
            data: { pagination, filters },
          }),
        }),
      },
    });

    const result = await runWithContext({} as any, () =>
      paged.actions.list({
        pagination: { pageToken: "next" },
        filters: [{ field: "name" }],
      }),
    );

    expect(result).toEqual({
      data: {
        pagination: { pageSize: "10", pageToken: "next" },
        filters: [{ field: "name", op: "eq" }],
      },
    });
  });

  it("fills the missing values of a dynamicObject input's selected configuration", async () => {
    const dyn = component({
      key: "dyn",
      public: true,
      display: { label: "Dyn", description: "x" },
      actions: {
        send: action({
          display: { label: "Send", description: "x" },
          inputs: {
            target: dynamicObjectInput({
              label: "Target",
              configurations: {
                email: {
                  label: "Email",
                  inputs: {
                    address: input({ type: "string", label: "Address" }),
                    subject: input({ type: "string", label: "Subject", default: "Hello" }),
                  },
                },
              },
            }),
          },
          perform: async (_context, { target }) => ({ data: target }),
        }),
      },
    });

    const result = await runWithContext({} as any, () =>
      dyn.actions.send({
        target: { configuration: "email", values: { address: "a@b.c" } },
      }),
    );

    expect(result).toEqual({
      data: { configuration: "email", values: { address: "a@b.c", subject: "Hello" } },
    });
  });

  it("normalizes a bare (non-{data}) return value into { data: ... }", async () => {
    const result = await runWithContext({} as any, () => echo.actions.bareReturn({}));

    expect(result).toEqual({ data: "just a string" });
  });

  it("throws if invoked outside of runWithContext", async () => {
    await expect(echo.actions.sayHello({ name: "Pat" })).rejects.toThrow(
      "ActionContext not found. Ensure this code is wrapped via runWithContext.",
    );
  });

  it("lets ConnectionErrors propagate unchanged", async () => {
    const connection = { key: "myConnection" };
    await expect(
      runWithContext({} as any, () => echo.actions.blowUp({ connection })),
    ).rejects.toBeInstanceOf(ConnectionError);
  });

  it("wraps any other thrown error in a UserError, matching the registry path's boundary", async () => {
    const error = await runWithContext({} as any, () => echo.actions.blowUpPlain({})).catch(
      (e) => e,
    );

    expect(isUserError(error)).toBe(true);
    expect(error.message).toBe("boom");
  });

  it("lets an already-wrapped UserError pass through unchanged", async () => {
    const alreadyWrapped = new UserError(new Error("already wrapped"));
    const wrapOnce = component({
      key: "wrap-once",
      public: true,
      display: { label: "Wrap Once", description: "x" },
      actions: {
        blowUp: action({
          display: { label: "Blow Up", description: "x" },
          inputs: {},
          perform: async () => {
            throw alreadyWrapped;
          },
        }),
      },
    });

    const error = await runWithContext({} as any, () => wrapOnce.actions.blowUp({})).catch(
      (e) => e,
    );

    expect(error).toBe(alreadyWrapped);
  });

  it("still exposes .perform for the runner's (context, params) invocation", async () => {
    expect(typeof echo.actions.sayHello.perform).toBe("function");

    const result = await echo.actions.sayHello.perform({} as any, { name: "Direct" });
    expect(result).toEqual({ data: "Hello, Direct!" });
  });
});
