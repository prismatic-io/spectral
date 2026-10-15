import type { InputValue } from "./ActionInputParameters";
import type { ConfigVarExpression, ValueExpression } from "./ComponentRegistry";
import type { ConfigVarVisibility } from "./ConfigVars";
import type { Inputs } from "./Inputs";

/** The published component a connection reference points at; `prism integrations:import`
 * pins the version. */
export interface ComponentClientIdentity {
  key: string;
  isPublic: boolean;
}

export type ComponentClientConnectionValues<TInputs extends Record<string, unknown>> = {
  [K in keyof TInputs]?:
    | ((ValueExpression<InputValue<TInputs[K]>> | ConfigVarExpression) &
        ConfigVarVisibility & { writeOnly?: true })
    | (ConfigVarVisibility & { writeOnly?: true });
};

/**
 * A connection config var's reference to a connection on the published component. Connections
 * are platform objects (credentials, OAuth flows, sharing with low-code and other integrations),
 * so unlike a bundled component's actions, triggers and data sources, they are not carried
 * into the integration; the reference is resolved by the platform.
 */
export interface ComponentClientReference<TInputs extends Record<string, unknown> = Inputs> {
  __componentClientReference: true;
  kind: "connection";
  component: ComponentClientIdentity;
  key: string;
  inputs: TInputs;
  values: ComponentClientConnectionValues<TInputs>;
  template?: string;
  onPremiseConnectionConfig?: "allowed" | "disallowed" | "required";
}

export const isComponentClientReference = (value: unknown): value is ComponentClientReference =>
  typeof value === "object" &&
  value !== null &&
  (value as { __componentClientReference?: unknown }).__componentClientReference === true;
