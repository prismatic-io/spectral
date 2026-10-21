const { action, callableComponent, component, flow } = require("../dist/index.js");
const { createHarness } = require("../dist/testing.js");

exports.contract = ({ test, expect }) => {
  test("preserves configuration and consumed one-off behavior before initialization", async () => {
    const calls = callableComponent({
      actions: {
        send: action({
          display: { label: "Send", description: "Send" },
          inputs: {},
          perform: async () => ({ data: "real" }),
        }),
      },
    });

    const tested = flow({
      name: "Early",
      stableKey: "early",
      onExecution: () => calls.actions.send(),
    });

    const harness = createHarness(tested);
    const mock = harness.mock(calls.actions.send);
    mock.mockResolvedValueOnce({ data: "once" }).mockResolvedValue({ data: "default" });

    expect(await mock()).toEqual({ data: "once" });
    expect((await harness.run()).result).toEqual({ data: "default" });
    expect(mock).toHaveBeenCalledTimes(2);
  });

  test("uses native assertions with automatic and explicit mocks in the built package", async () => {
    let actualCalls = 0;
    const examplePayload = { data: { message: "example" } };
    const calls = callableComponent(
      component({
        key: "runner-fixture",
        display: { label: "Runner", description: "Runner", iconPath: "icon.png" },
        actions: {
          send: action({
            display: { label: "Send", description: "Send" },
            inputs: {},
            perform: async () => {
              actualCalls++;

              return { data: { message: "real" } };
            },
            examplePayload,
          }),
          empty: action({
            display: { label: "Empty", description: "Empty" },
            inputs: {},
            perform: async () => {
              actualCalls++;

              return { data: true };
            },
          }),
        },
      }),
    );

    const tested = flow({
      name: "Runner",
      stableKey: "runner",
      onExecution: () => calls.actions.send(),
    });

    const harness = createHarness(tested);
    const mock = harness.mock(calls.actions.send);

    expect(mock).not.toHaveBeenCalled();
    mock.mockResolvedValueOnce({ data: { message: "override" } });

    expect((await harness.run()).result).toEqual({ data: { message: "override" } });
    expect((await harness.run()).result).toEqual(examplePayload);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenCalledWith();
    expect(harness.mock(calls.actions.send)).toBe(mock);
    expect(await harness.invoke(() => calls.actions.empty())).toBeUndefined();
    expect(harness.mock(calls.actions.empty)).toHaveBeenCalledTimes(1);
    mock.mockClear();

    expect(mock).not.toHaveBeenCalled();
    mock.mockRejectedValueOnce(new Error("offline"));
    await expect(harness.run()).rejects.toThrow("offline");

    expect(actualCalls).toBe(0);
  });
};
