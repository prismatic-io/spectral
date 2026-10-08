import { describe, expect, it } from "vitest";
import { action, component, input, structuredObjectInput } from "..";
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
  it("keeps producing plain, non-callable actions, unconditionally", () => {
    // This is the legacy shape prism components:publish / manifest generation /
    // the runner all still consume. It must never change on its own.
    expect(typeof rawEcho.actions.sayHello).toBe("object");
    expect(typeof rawEcho.actions.sayHello.perform).toBe("function");
  });
});

describe("component(definition, { callable: true })", () => {
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

  it("produces the same callable shape as component() + createCallableComponent", async () => {
    const viaOption = component(echoDefinition, { callable: true });
    const viaWrapper = createCallableComponent(component(echoDefinition));

    expect(typeof viaOption.actions.sayHello).toBe("function");

    const result = await runWithContext({} as any, () =>
      viaOption.actions.sayHello({ name: "Pat" }),
    );
    expect(result).toEqual({ data: "Hello, Pat!" });
    expect(typeof viaWrapper.actions.sayHello).toBe("function");
  });

  it("omitting the option (or passing callable: false) stays plain, like component() alone", () => {
    const withoutOption = component(echoDefinition);
    const explicitlyFalse = component(echoDefinition, { callable: false });

    expect(typeof withoutOption.actions.sayHello).toBe("object");
    expect(typeof explicitlyFalse.actions.sayHello).toBe("object");
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
    const paged = component(
      {
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
      },
      { callable: true },
    );

    const result = await runWithContext({} as any, () => paged.actions.list({}));

    expect(result).toEqual({ data: { query: "", pageSize: "10", pageToken: "" } });
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
    const wrapOnce = component(
      {
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
      },
      { callable: true },
    );

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
