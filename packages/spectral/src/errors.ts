import type { Connection } from ".";

/**
 * Base error class for Spectral-specific errors. Extends the standard
 * `Error` class with an `isSpectralError` flag for easy identification
 * when handling errors in component hooks.
 *
 * @see {@link https://prismatic.io/docs/custom-connectors/error-handling/ | Error Handling}
 * @example
 * import { SpectralError } from "@prismatic-io/spectral";
 *
 * throw new SpectralError("Something went wrong during data processing");
 */
export class SpectralError extends Error {
  isSpectralError: boolean;

  constructor(message: string) {
    super(message);
    this.isSpectralError = true;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * An error class for connection-related failures. Includes a reference to
 * the `Connection` object that caused the error, so error handlers can
 * inspect connection details.
 *
 * When thrown, the Prismatic platform will display a "Configuration Error"
 * badge on the instance, signaling that the connection needs attention.
 *
 * @see {@link https://prismatic.io/docs/custom-connectors/error-handling/ | Error Handling}
 * @example
 * import { ConnectionError } from "@prismatic-io/spectral";
 *
 * // Inside an action perform function
 * const myAction = action({
 *   // ...
 *   perform: async (context, { connection }) => {
 *     try {
 *       // Call external API...
 *     } catch (err) {
 *       throw new ConnectionError(connection, "Invalid API credentials");
 *     }
 *   },
 * });
 */
export class ConnectionError extends SpectralError {
  connection: Connection;

  constructor(connection: Connection, message: string) {
    super(message);
    this.connection = connection;
  }
}

/**
 * Type guard to check if an error is a `SpectralError`.
 *
 * @param payload The error to test.
 * @returns True if `payload` is a `SpectralError`, false otherwise.
 * @example
 * import { isSpectralError } from "@prismatic-io/spectral";
 *
 * try {
 *   // ...
 * } catch (err) {
 *   if (isSpectralError(err)) {
 *     console.log("Caught a Spectral error:", err.message);
 *   }
 * }
 */
export const isSpectralError = (payload: unknown): payload is SpectralError =>
  Boolean(
    payload &&
      typeof payload === "object" &&
      "isSpectralError" in payload &&
      (payload as SpectralError).isSpectralError === true,
  );

/**
 * Type guard to check if an error is a `ConnectionError`.
 *
 * @param payload The error to test.
 * @returns True if `payload` is a `ConnectionError`, false otherwise.
 * @example
 * import { isConnectionError } from "@prismatic-io/spectral";
 *
 * try {
 *   // ...
 * } catch (err) {
 *   if (isConnectionError(err)) {
 *     console.log("Connection failed:", err.connection.key, err.message);
 *   }
 * }
 */
export const isConnectionError = (payload: unknown): payload is ConnectionError =>
  isSpectralError(payload) && "connection" in payload;

const deriveWrappedErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
};

/**
 * Wraps an arbitrary thrown value as a user-consumable error. Mirrors the platform's own error
 * boundary for a registry-invoked action: `ConnectionError`s and already-wrapped `UserError`s
 * pass through unchanged, everything else gets wrapped in one of these, so a directly-called
 * npm action's failures classify the same way a registry-invoked one's would.
 *
 * @see {@link https://prismatic.io/docs/custom-connectors/error-handling/ | Error Handling}
 */
export class UserError extends SpectralError {
  wrappedError: unknown;

  constructor(error: unknown) {
    if (error instanceof Error) {
      // Don't carry the original stack trace into a user-facing error: the wrapped code is
      // likely bundled/minified anyway, so the stack isn't useful, and it could leak
      // implementation details.
      error.stack = undefined;
    }
    super(deriveWrappedErrorMessage(error));
    this.wrappedError = error;
  }
}

/**
 * Type guard to check if an error is a `UserError`.
 *
 * @param payload The error to test.
 * @returns True if `payload` is a `UserError`, false otherwise.
 * @example
 * import { isUserError } from "@prismatic-io/spectral";
 *
 * try {
 *   // ...
 * } catch (err) {
 *   if (isUserError(err)) {
 *     console.log("Already a user error:", err.message);
 *   }
 * }
 */
export const isUserError = (payload: unknown): payload is UserError =>
  isSpectralError(payload) && "wrappedError" in payload;
