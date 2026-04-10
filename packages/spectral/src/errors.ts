import { Connection } from ".";

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
