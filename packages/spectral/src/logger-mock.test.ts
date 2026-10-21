import { describe, expect, it, vi } from "vitest";
import { localMock } from "./localMock";
import { loggerMock } from "./testing";

describe("isolated logger mocks", () => {
  it("records each log level without replacing or forwarding to console methods", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const first = loggerMock();
      const second = loggerMock();
      first.info("first", { id: 1 });
      for (const level of [
        "metric",
        "trace",
        "debug",
        "log",
        "warn",
        "error",
        "section",
      ] as const) {
        first[level]("event");

        expect(first[level]).toHaveBeenCalledWith("event");
        expect(second[level]).not.toHaveBeenCalled();
      }
      first.sectionEnd({ label: "event", data: { done: true } });

      expect(first.sectionEnd).toHaveBeenCalledWith({ label: "event", data: { done: true } });
      expect(second.sectionEnd).not.toHaveBeenCalled();
      expect(first.info).toHaveBeenCalledExactlyOnceWith("first", { id: 1 });
      expect(second.info).not.toHaveBeenCalled();
      expect(console.info).toBe(info);
      expect(info).not.toHaveBeenCalled();
    } finally {
      info.mockRestore();
    }
  });

  it("records receiver, returned values, and exceptions without replaying calls", () => {
    const error = new Error("failure");
    const mock = localMock()
      .mockImplementationOnce(() => {
        throw error;
      })
      .mockReturnValue("default");
    const receiver = { mock };

    expect(() => receiver.mock("first")).toThrow(error);
    expect(receiver.mock("second")).toBe("default");
    expect(mock.mock.contexts).toEqual([receiver, receiver]);
    expect(mock.mock.results).toEqual([
      { type: "throw", value: error },
      { type: "return", value: "default" },
    ]);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mockClear()).toBe(mock);
    expect(mock).not.toHaveBeenCalled();
    expect(mock()).toBe("default");
  });

  it("consumes one-time responses in order and retains the default implementation", async () => {
    const mock = localMock()
      .mockResolvedValue("default")
      .mockResolvedValueOnce("first")
      .mockRejectedValueOnce(new Error("retry"));
    await expect(mock()).resolves.toBe("first");
    await expect(mock()).rejects.toThrow("retry");
    await expect(mock()).resolves.toBe("default");
  });
});

it("retains per-mock controls used by Vitest consumers", async () => {
  const mock = localMock().mockName("info").mockReturnValue("default");
  mock("before");
  const oldState = mock.mock;
  expect(mock.getMockName()).toBe("info");
  expect(mock.mock.lastCall).toEqual(["before"]);
  mock.mockClear();
  expect(mock).not.toHaveBeenCalled();
  expect(oldState.calls).toEqual([["before"]]);
  expect(mock()).toBe("default");

  mock.mockReturnValueOnce("queued");
  await mock.withImplementation(
    () => "temporary",
    async () => {
      await Promise.resolve();
      expect(mock()).toBe("temporary");
    },
  );
  expect(mock()).toBe("queued");
  expect(mock()).toBe("default");
  const receiver = { mock: mock.mockReturnThis() };
  expect(receiver.mock()).toBe(receiver);
  expect(mock.mock.contexts.at(-1)).toBe(receiver);
  expect(mock.mock.instances.at(-1)).toBe(receiver);

  mock.mockReturnValueOnce("discard").mockReset();
  expect(mock).not.toHaveBeenCalled();
  expect(mock()).toBeUndefined();
  mock.mockReturnValue("discard").mockRestore();
  expect(mock).not.toHaveBeenCalled();
  expect(mock()).toBeUndefined();
});

it("restores temporary implementations after callbacks fail", async () => {
  const mock = localMock().mockReturnValue("default").mockReturnValueOnce("queued");
  const fail = () => {
    throw new Error("failed");
  };
  expect(() => mock.withImplementation(() => "temporary", fail)).toThrow("failed");
  await expect(
    mock.withImplementation(
      () => "temporary",
      async () => fail(),
    ),
  ).rejects.toThrow("failed");
  expect(mock()).toBe("queued");
  expect(mock()).toBe("default");
});

it("supports Vitest call-order assertions across local mocks", () => {
  const first = localMock();
  const second = localMock();
  first();
  second();
  expect(first).toHaveBeenCalledBefore(second);
});
