import type {
  BaseConfigVar,
  NpmConnectionReferenceConfigVar,
  OnPremiseConnectionConfigTypeEnum,
} from "../types";
import type { AnyConnection } from ".";

export type { NpmConnectionReference } from "../types";
export { isNpmConnectionReference } from "../types";

/**
 * The config-var-level fields accepted alongside the connection's own input values (`values`)
 * when declaring a config var directly from a connection reference — see
 * {@link createCallableConnection}.
 *
 * The connection's own declarative shape (`oauth2Type`, `oauth2Config`, its `inputs` schema) is
 * inferred from the connection itself, not accepted here.
 */
export type CallableConnectionConfigVar = BaseConfigVar & {
  values?: Record<string, unknown>;
  template?: string;
  onPremiseConnectionConfig?: OnPremiseConnectionConfigTypeEnum;
};

/**
 * Wraps an already-converted connection as a callable that directly produces the config var it
 * backs, e.g.:
 *
 * ```ts
 * "Foo Connection": foo.connections.oauth2({
 *   stableKey: "foo-connection",
 *   description: "Connect to Foo",
 *   values: { clientId: { value: "..." }, clientSecret: { value: "..." } },
 * }),
 * ```
 *
 * Only relevant when its caller opts in via `component(definition, { callable: true })`.
 */
export const createCallableConnection =
  (connection: AnyConnection) =>
  ({
    values = {},
    template,
    onPremiseConnectionConfig,
    ...configVar
  }: CallableConnectionConfigVar): NpmConnectionReferenceConfigVar => ({
    ...configVar,
    dataType: "connection",
    connection: {
      __npmConnectionReference: true,
      connection,
      values,
      template,
      onPremiseConnectionConfig,
    },
  });
