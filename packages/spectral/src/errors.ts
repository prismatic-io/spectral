import { Connection } from ".";

export class SpectralError extends Error {
  isSpectralError: boolean;

  constructor(message: string) {
    super(message);
    this.isSpectralError = true;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConnectionError extends SpectralError {
  connection: Connection;

  constructor(connection: Connection, message: string) {
    super(message);
    this.connection = connection;
  }
}

export const isSpectralError = (payload: unknown): payload is SpectralError =>
  Boolean(
    payload &&
      typeof payload === "object" &&
      "isSpectralError" in payload &&
      (payload as SpectralError).isSpectralError === true,
  );

export const isConnectionError = (payload: unknown): payload is ConnectionError =>
  isSpectralError(payload) && "connection" in payload;
