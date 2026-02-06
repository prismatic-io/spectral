import { describe, expect } from "vitest";
import { test } from "@fast-check/vitest";
import type { AxiosError } from "axios";
import { toAxiosRetryConfig } from ".";

describe("Ensure retry configuration functions work as expected", () => {
  test("Delay function returns fixed delay when useExponentialBackoff is false", () => {
    const retryDelay = 1234;
    const axiosConfig = toAxiosRetryConfig({
      retries: 3,
      retryDelay,
      useExponentialBackoff: false,
    });
    const delayFunction = axiosConfig.retryDelay;
    expect(delayFunction?.(3, {} as AxiosError)).toEqual(retryDelay);
  });
  test("Delay function returns retryDelay when useExponentialBackoff is true on first retry", () => {
    const retryDelay = 1234;
    const axiosConfig = toAxiosRetryConfig({ retries: 3, retryDelay, useExponentialBackoff: true });
    const delayFunction = axiosConfig.retryDelay;
    expect(delayFunction?.(1, {} as AxiosError)).toEqual(retryDelay);
  });
  test("Delay function returns retryDelay * 2 * 2 when useExponentialBackoff is true on fourth retry", () => {
    const retryDelay = 1234;
    const axiosConfig = toAxiosRetryConfig({ retries: 4, retryDelay, useExponentialBackoff: true });
    const delayFunction = axiosConfig.retryDelay;
    expect(delayFunction?.(4, {} as AxiosError)).toEqual(retryDelay * 2 ** 3);
  });
  test("Delay function returns exponential delay when useExponentialBackoff is true and retryDelay is not set", () => {
    const axiosConfig = toAxiosRetryConfig({ retries: 3, useExponentialBackoff: true });
    const delayFunction = axiosConfig.retryDelay;
    const delay1 = delayFunction?.(1, {} as AxiosError);
    const delay2 = delayFunction?.(2, {} as AxiosError);
    const delay3 = delayFunction?.(3, {} as AxiosError);

    // By default, axios-retry's exponentialDelay function returns 200 (+20% random jitter) on first retry,
    // 400 (+20% random jitter) on second retry, 800 (+20% random jitter) on third retry, etc.
    expect(delay1).toBeGreaterThanOrEqual(100 * 2);
    expect(delay1).toBeLessThanOrEqual(100 * 2 * 1.2);
    expect(delay2).toBeGreaterThanOrEqual(100 * 4);
    expect(delay2).toBeLessThanOrEqual(100 * 4 * 1.2);
    expect(delay3).toBeGreaterThanOrEqual(100 * 8);
    expect(delay3).toBeLessThanOrEqual(100 * 8 * 1.2);
  });
});
