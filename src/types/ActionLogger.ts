/**
 * Actions' perform functions receive a logger object as part of their first parameter.
 * Types in this file define the shape of the logger that is passed to an action.
 * For information on the logger object, see:
 * https://prismatic.io/docs/custom-components/writing-custom-components#contextlogger
 */

/**
 * A logger function, similar to `console.log()` or `console.error()`.
 */
export type ActionLoggerFunction = (...args: unknown[]) => void;

/**
 * An object containing logger functions.
 */
export interface ActionLogger {
  debug: ActionLoggerFunction;
  info: ActionLoggerFunction;
  log: ActionLoggerFunction;
  warn: ActionLoggerFunction;
  error: ActionLoggerFunction;
}
