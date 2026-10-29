import { describe, expect, it, vi } from "vitest";
import { action, callableComponent, flow, input } from ".";
import { createHarness, type InvokeFlowOptions } from "./testing";
import type { Connection } from "./types";

const display = { label: "Workflow dependency", description: "Workflow dependency" };
const dependencies = () => {
  const real = vi.fn(() => {
    throw new Error("A real dependency must never execute in these CNI tests");
  });

  const api = callableComponent({
    actions: {
      list: action({
        display,
        inputs: { cursor: input({ label: "Cursor", type: "string" }) },
        perform: async () => {
          real();

          return { data: { items: [] as { id: string }[], cursor: "" } };
        },
      }),
      send: action({
        display,
        inputs: {
          text: input({ label: "Text", type: "string" }),
          channel: input({ label: "Channel", type: "string" }),
          connection: input({ label: "Connection", type: "connection" }),
        },
        perform: async () => {
          real();

          return { data: { id: "real" } };
        },
        examplePayload: { data: { id: "example" } },
      }),
      remove: action({
        display,
        inputs: { id: input({ label: "ID", type: "string" }) },
        perform: async () => {
          real();

          return { data: true };
        },
      }),
    },
  });

  return { api, real };
};

const test = it.extend<{ api: ReturnType<typeof dependencies>["api"] }>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest fixtures require destructuring their context.
  api: async ({}, use) => {
    const { api, real } = dependencies();
    await use(api);

    expect(real).not.toHaveBeenCalled();
  },
});

describe("CNI workflow smoke scenarios", () => {
  test("passes cursors through successive mocked dependency calls", async ({ api }) => {
    const harness = createHarness(
      flow({
        name: "Paginated sync",
        stableKey: "paginated-sync",
        onExecution: async () => {
          let cursor = "";
          const ids: string[] = [];
          do {
            const page = await api.actions.list({ cursor });
            ids.push(...page.data.items.map(({ id }) => id));
            cursor = page.data.cursor;
          } while (cursor);

          return { data: ids };
        },
      }),
    );

    const list = harness.mock(api.actions.list);
    list
      .mockResolvedValueOnce({ data: { items: [{ id: "first" }], cursor: "next" } })
      .mockResolvedValueOnce({ data: { items: [{ id: "last" }], cursor: "" } });

    expect((await harness.run()).result?.data).toEqual(["first", "last"]);
    expect(list.mock.calls).toEqual([[{ cursor: "" }], [{ cursor: "next" }]]);
  });

  test.for([
    false,
    true,
  ])("validates incoming opportunities before external writes (invalid=%s)", async (invalid, {
    api,
  }) => {
    const harness = createHarness(
      flow({
        name: "Create opportunity",
        stableKey: "create-opportunity",
        onTrigger: async (_context, payload) => {
          const body = JSON.parse(String(payload.body.data)) as { name: string; value: number };
          if (body.value < 0) throw new Error("Invalid value");

          const response = await api.actions.send({ text: `${body.name}: ${body.value}` });

          return { payload: { ...payload, body: { ...payload.body, data: response.data } } };
        },
        onExecution: async (_context, params) => ({ data: params.onTrigger.results.body.data }),
      }),
    );

    const run = harness.run({
      payload: { body: { data: JSON.stringify({ name: "Acme", value: invalid ? -1 : 100 }) } },
    });

    if (invalid) {
      await expect(run).rejects.toThrow("Invalid value");

      expect(harness.mock(api.actions.send)).not.toHaveBeenCalled();
    } else {
      expect((await run).result?.data.id).toBe("example");
      expect(harness.mock(api.actions.send)).toHaveBeenCalledExactlyOnceWith({ text: "Acme: 100" });
    }
  });

  test("passes legacy config values and connection credentials through cosmetic helpers", async ({
    api,
  }) => {
    const notify = api.actions.send;
    const harness = createHarness(
      flow({
        name: "Configured alert",
        stableKey: "configured-alert",
        onExecution: async (context) => {
          // This fixture has no project-wide ConfigPages augmentation.
          const configVars = context.configVars as unknown as {
            Channel: string;
            Connection: Connection;
          };

          return notify({
            text: "alert",
            channel: configVars.Channel,
            connection: configVars.Connection,
          });
        },
      }),
    );

    await harness.run({
      configVars: {
        Channel: "support",
        Connection: { key: "oauth2", fields: {}, token: { access_token: "fake" } },
      },
    } as unknown as InvokeFlowOptions);

    expect(harness.mock(notify)).toHaveBeenCalledExactlyOnceWith({
      text: "alert",
      channel: "support",
      connection: { key: "oauth2", fields: {}, token: { access_token: "fake" }, configVarKey: "" },
    });
  });

  test("updates the caller's persisted checkpoint only after successful delivery", async ({
    api,
  }) => {
    const state = { lastId: "previous" };
    const harness = createHarness(
      flow({
        name: "Checkpoint",
        stableKey: "checkpoint",
        onExecution: async ({ instanceState }) => {
          const response = await api.actions.send({ text: String(instanceState.lastId) });
          instanceState.lastId = response.data.id;

          return { data: response.data.id };
        },
      }),
    );
    harness
      .mock(api.actions.send)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: { id: "next" } });
    await expect(harness.run({ context: { instanceState: state } })).rejects.toThrow("offline");

    expect(state.lastId).toBe("previous");
    await harness.run({ context: { instanceState: state } });

    expect(state.lastId).toBe("next");
    await harness.run({ context: { instanceState: state } });

    expect(harness.mock(api.actions.send).mock.calls.map(([args]) => args?.text)).toEqual([
      "previous",
      "previous",
      "next",
    ]);
  });

  test("runs user deployment and deletion logic while mocking its webhook API dependencies", async ({
    api,
  }) => {
    const state: Record<string, unknown> = {};
    const harness = createHarness(
      flow({
        name: "Webhooks",
        stableKey: "webhooks",
        onInstanceDeploy: async ({ instanceState }) => {
          const { data } = await api.actions.send({ text: "create webhook" });
          instanceState.webhookId = data.id;

          return { instanceState };
        },
        onInstanceDelete: async ({ instanceState }) => {
          await api.actions.remove({ id: String(instanceState.webhookId) });

          return { instanceState: {} };
        },
        onExecution: async () => ({ data: "execution" }),
      }),
    );

    await harness.run();

    expect(harness.mock(api.actions.send)).not.toHaveBeenCalled();
    expect(await harness.onInstanceDeploy({ context: { instanceState: state } })).toEqual({
      instanceState: { webhookId: "example" },
    });

    expect(await harness.onInstanceDelete({ context: { instanceState: state } })).toEqual({
      instanceState: {},
    });

    expect(harness.mock(api.actions.remove)).toHaveBeenCalledExactlyOnceWith({ id: "example" });
  });
});
