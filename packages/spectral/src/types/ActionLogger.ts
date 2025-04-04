/**
 * Actions' perform functions receive a logger object as part of their first parameter.
 * Types in this file define the shape of the logger that is passed to an action.
 * For information on the logger object, see:
 * https://prismatic.io/docs/custom-connectors/actions/#logger-object
 */

/**
 * A logger function, similar to `console.log()` or `console.error()`.
 */
export type ActionLoggerFunction = (...args: unknown[]) => void;

/**
 * An object containing logger functions. See
 * https://prismatic.io/docs/custom-connectors/actions/#logger-object
 */
export interface ActionLogger {
  metric: ActionLoggerFunction;
  trace: ActionLoggerFunction;
  debug: ActionLoggerFunction;
  info: ActionLoggerFunction;
  log: ActionLoggerFunction;
  warn: ActionLoggerFunction;
  error: ActionLoggerFunction;
}
