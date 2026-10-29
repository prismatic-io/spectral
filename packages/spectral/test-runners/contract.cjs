// Runner adaptation only: source tests own cloning, identity, and execution-scope semantics.
const { action, callableComponent, flow } = require("../dist/index.js");
const { createHarness } = require("../dist/testing.js");

function fixture() {
  let realCalls = 0;
  const calls = callableComponent({
    actions: {
      send: action({
        display: { label: "Send", description: "Send" },
        inputs: {},
        examplePayload: { data: { value: "example" } },
        perform: async () => {
          realCalls++;
          return { data: "real" };
        },
      }),
    },
  });
  const captured = calls.actions.send;
  const tested = flow({ name: "Runner", stableKey: "runner", onExecution: () => captured() });

  return { captured, harness: createHarness(tested), realCalls: () => realCalls };
}

exports.contract = ({ test, expect, vi, jest }) => {
  const runner = vi ?? jest;

  test("preserves configuration and consumed one-off behavior before initialization", async () => {
    const { harness, captured } = fixture();
    const mock = harness.mock(captured);
    mock.mockResolvedValueOnce({ data: "once" }).mockResolvedValue({ data: "default" });

    expect(await mock()).toEqual({ data: "once" });
    expect((await harness.run()).result).toEqual({ data: "default" });
    expect(mock).toHaveBeenCalledTimes(2);
  });

  test("uses native assertions with automatic and explicit mocks in the built package", async () => {
    const { harness, captured, realCalls } = fixture();
    const mock = harness.mock(captured);

    expect(mock).not.toHaveBeenCalled();
    mock.mockResolvedValueOnce({ data: "override" });

    expect((await harness.run()).result).toEqual({ data: "override" });
    expect((await harness.run()).result).toEqual({ data: { value: "example" } });
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenCalledWith();
    expect(harness.mock(captured)).toBe(mock);
    mock.mockClear();

    expect(mock).not.toHaveBeenCalled();
    mock.mockRejectedValueOnce(new Error("offline"));
    await expect(harness.run()).rejects.toThrow("offline");

    expect(realCalls()).toBe(0);
  });

  test("supports configuring a mock after an automatic example invocation", async () => {
    const { harness, captured } = fixture();
    await harness.run();
    const mock = harness.mock(captured);
    mock.mockResolvedValue({ data: "changed" });

    expect((await harness.run()).result).toEqual({ data: "changed" });
    expect(mock).toHaveBeenCalledTimes(2);
  });

  test("clears early history without consuming pending once responses", async () => {
    const { harness, captured } = fixture();
    const mock = harness.mock(captured);
    await mock();
    mock.mockResolvedValueOnce({ data: "once" });

    expect(mock.mockClear()).toBe(mock);
    expect((await harness.run()).result).toEqual({ data: "once" });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  test("preserves the current once queue after an early reset", async () => {
    const { harness, captured } = fixture();
    const mock = harness.mock(captured);
    mock.mockResolvedValueOnce({ data: "discarded" });
    mock.mockReset();
    mock.mockResolvedValueOnce({ data: "after reset" });

    expect((await harness.run()).result).toEqual({ data: "after reset" });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  test("retains synchronous early exceptions and pending once responses", async () => {
    const { harness, captured } = fixture();
    const mock = harness.mock(captured);
    mock.mockImplementationOnce(() => {
      throw new Error("sync early");
    });
    mock.mockResolvedValueOnce({ data: "later" });

    expect(() => mock()).toThrow("sync early");
    expect((await harness.run()).result).toEqual({ data: "later" });
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mock.results[0].type).toBe("throw");
  });

  test("records early explicit calls for native return-value assertions after initialization", async () => {
    const { harness, captured } = fixture();
    const mock = harness.mock(captured);
    const early = mock({ id: "early" });
    await harness.run();

    expect(mock).toHaveNthReturnedWith(1, early);
    expect(mock).toHaveBeenNthCalledWith(1, { id: "early" });
  });

  test("native clearAllMocks clears history while retaining examples", async () => {
    const { harness, captured } = fixture();
    await harness.run();
    runner.clearAllMocks();

    expect(harness.mock(captured)).not.toHaveBeenCalled();
    expect((await harness.run()).result).toEqual({ data: { value: "example" } });
  });

  test("native resetAllMocks preserves runner semantics without executing the dependency", async () => {
    const { harness, captured, realCalls } = fixture();
    await harness.run();
    harness.mock(captured).mockResolvedValue({ data: "custom" });
    const native = runner.fn(async () => ({ data: { value: "example" } }));
    native.mockResolvedValue({ data: "custom" });
    runner.resetAllMocks();

    // Jest resets to undefined, Vitest restores the initial example, and Bun
    // currently retains the configured implementation through resetAllMocks.
    const result = (await harness.run()).result;

    expect(result).toEqual(await native());
    expect(realCalls()).toBe(0);
  });
};
