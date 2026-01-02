import { cleanParams, createPollingContext, type CleanFn } from "./perform";
import type { ActionContext } from "../types";

describe("createPollingContext", () => {
  const createMockContext = (instanceState: Record<string, unknown> = {}): ActionContext =>
    ({
      instanceState,
    }) as ActionContext;

  it("returns empty state when instanceState has no __prismaticInternal", () => {
    const context = createMockContext({});
    const pollingContext = createPollingContext({
      context,
      invokeAction: jest.fn(),
    });

    expect(pollingContext.polling.getState()).toEqual({});
  });

  it("returns empty state when __prismaticInternal has no polling property", () => {
    const context = createMockContext({
      __prismaticInternal: { otherData: "test" },
    });
    const pollingContext = createPollingContext({
      context,
      invokeAction: jest.fn(),
    });

    expect(pollingContext.polling.getState()).toEqual({});
  });

  it("returns polling state when it exists", () => {
    const pollingState = { lastPoll: "2024-01-01", cursor: "abc123" };
    const context = createMockContext({
      __prismaticInternal: { polling: pollingState },
    });
    const pollingContext = createPollingContext({
      context,
      invokeAction: jest.fn(),
    });

    expect(pollingContext.polling.getState()).toEqual(pollingState);
  });

  it("setState creates __prismaticInternal.polling when it does not exist", () => {
    const context = createMockContext({});
    const pollingContext = createPollingContext({
      context,
      invokeAction: jest.fn(),
    });

    pollingContext.polling.setState({ cursor: "new-cursor" });

    expect(context.instanceState.__prismaticInternal).toEqual({
      polling: { cursor: "new-cursor" },
    });
  });

  it("setState preserves other __prismaticInternal properties", () => {
    const context = createMockContext({
      __prismaticInternal: { otherData: "preserved" },
    });
    const pollingContext = createPollingContext({
      context,
      invokeAction: jest.fn(),
    });

    pollingContext.polling.setState({ cursor: "new-cursor" });

    expect(context.instanceState.__prismaticInternal).toEqual({
      otherData: "preserved",
      polling: { cursor: "new-cursor" },
    });
  });

  it("setState replaces entire polling state", () => {
    const context = createMockContext({
      __prismaticInternal: { polling: { oldKey: "old-value" } },
    });
    const pollingContext = createPollingContext({
      context,
      invokeAction: jest.fn(),
    });

    pollingContext.polling.setState({ newKey: "new-value" });

    expect(context.instanceState.__prismaticInternal).toEqual({
      polling: { newKey: "new-value" },
    });
  });

  it("invokeAction is passed through correctly", async () => {
    const mockInvokeAction = jest.fn().mockResolvedValue({ data: "result" });
    const context = createMockContext({});
    const pollingContext = createPollingContext({
      context,
      invokeAction: mockInvokeAction,
    });

    const result = await pollingContext.polling.invokeAction({ testInput: "value" });

    expect(mockInvokeAction).toHaveBeenCalledWith({ testInput: "value" });
    expect(result).toEqual({ data: "result" });
  });

  it("handles non-object __prismaticInternal gracefully", () => {
    const context = createMockContext({
      __prismaticInternal: "invalid-string-value" as unknown as Record<string, unknown>,
    });
    const pollingContext = createPollingContext({
      context,
      invokeAction: jest.fn(),
    });

    expect(pollingContext.polling.getState()).toEqual({});

    pollingContext.polling.setState({ cursor: "test" });
    expect(context.instanceState.__prismaticInternal).toEqual({
      polling: { cursor: "test" },
    });
  });
});

describe("cleanParams", () => {
  it.each<{
    params: Record<string, unknown>;
    cleaners: Record<string, CleanFn | undefined>;
    expected: Record<string, unknown>;
  }>([
    // Ensure all empty produces empty values collection
    { params: {}, cleaners: {}, expected: {} },
    // Ensure matched cleaners produce expected result
    {
      params: { foo: null },
      cleaners: { foo: (v: unknown) => "changed" },
      expected: { foo: "changed" },
    },
    // Ensure cleaners run even if input value not explicitly provided
    {
      params: {},
      cleaners: { foo: (v: unknown) => "ran" },
      expected: { foo: "ran" },
    },
  ])("runs input clean functions", ({ params, cleaners, expected }) => {
    expect(cleanParams(params, cleaners)).toStrictEqual(expected);
  });
});
