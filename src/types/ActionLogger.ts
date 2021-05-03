export type ActionLoggerFunction = (...args: unknown[]) => void;

export interface ActionLogger {
  debug: ActionLoggerFunction;
  info: ActionLoggerFunction;
  log: ActionLoggerFunction;
  warn: ActionLoggerFunction;
  error: ActionLoggerFunction;
}
