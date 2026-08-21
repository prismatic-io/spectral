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
 * Opens a log section. Logs emitted after this call are collated under the
 * section identified by `label` until the matching `sectionEnd(label)` is called.
 *
 * Sections cannot be nested: calling `section` again while a section is open keeps
 * the open section and ignores the new one.
 */
export type ActionLoggerSectionFunction = (label: string) => void;

/**
 * Closes the open log section. The `label` must match the label the section was
 * opened with; a `sectionEnd` whose label does not match the open section is
 * ignored. An optional `data` object is attached to the section as its result.
 */
export type ActionLoggerSectionEndFunction = (params: {
  label: string;
  data?: Record<string, unknown>;
}) => void;

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

/**
 * The logger passed to a code-native integration's flow execution. Adds the
 * `section`/`sectionEnd` controls for grouping a flow's logs; these take effect
 * only inside a code-native execution.
 */
export interface CodeNativeActionLogger extends ActionLogger {
  section: ActionLoggerSectionFunction;
  sectionEnd: ActionLoggerSectionEndFunction;
}
