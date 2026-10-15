import { describe, expect, it } from "vitest";
import { ConnectionError, isConnectionError, isSpectralError, SpectralError } from "./errors";

const connection = { key: "api", configVarKey: "API Connection", fields: {} };

// Minifiers rename constructor identifiers without changing their behavior.
const test = it.extend<{
  spectralError: SpectralError;
  connectionError: ConnectionError;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest fixtures require destructuring their context.
  spectralError: async ({}, use) => {
    const descriptor = Object.getOwnPropertyDescriptor(SpectralError, "name");
    Object.defineProperty(SpectralError, "name", { value: "a", configurable: true });
    await use(new SpectralError("failure"));
    if (descriptor) Object.defineProperty(SpectralError, "name", descriptor);
  },
  // biome-ignore lint/correctness/noEmptyPattern: Vitest fixtures require destructuring their context.
  connectionError: async ({}, use) => {
    const descriptor = Object.getOwnPropertyDescriptor(ConnectionError, "name");
    Object.defineProperty(ConnectionError, "name", { value: "a", configurable: true });
    await use(new ConnectionError(connection, "failure"));
    if (descriptor) Object.defineProperty(ConnectionError, "name", descriptor);
  },
});

describe("error names under minification", () => {
  test("preserves SpectralError's name", ({ spectralError }) => {
    expect(spectralError.name).toBe("SpectralError");
    expect(spectralError.toString()).toBe("SpectralError: failure");
    expect(spectralError.stack).toMatch(/^SpectralError: failure/);
    expect(spectralError).toBeInstanceOf(SpectralError);
    expect(isSpectralError(spectralError)).toBe(true);
    expect(isConnectionError(spectralError)).toBe(false);
  });

  test("preserves ConnectionError's name and connection", ({ connectionError }) => {
    expect(connectionError.name).toBe("ConnectionError");
    expect(connectionError.toString()).toBe("ConnectionError: failure");
    expect(connectionError.stack).toMatch(/^ConnectionError: failure/);
    expect(connectionError).toBeInstanceOf(SpectralError);
    expect(connectionError).toBeInstanceOf(ConnectionError);
    expect(isSpectralError(connectionError)).toBe(true);
    expect(isConnectionError(connectionError)).toBe(true);
    expect(connectionError.connection).toBe(connection);
  });
});
