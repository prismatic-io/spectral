import {
  type ConfigVar,
  isConnectionDefinitionConfigVar,
  isConnectionReferenceConfigVar,
} from "./ConfigVars";
import type { UnionToIntersection } from "./utils";

export type CustomerActivatedConnectionConfigVar = {
  dataType: "connection";
  stableKey: string;
};

export type OrganizationActivatedConnectionConfigVar = {
  dataType: "connection";
  stableKey: string;
};

/**
 * A connection each person activates for themselves.
 *
 * Carries its own `dataType` so it can be told apart from the organization- and
 * customer-activated kinds, which are otherwise identical. The convert layer rewrites
 * it to the shape the API expects before it reaches the server.
 */
export type UserActivatedConnectionConfigVar = {
  dataType: "userScopedConnection";
  stableKey: string;
};

/* More types may eventually be added to this union. */
export type ScopedConfigVar =
  | CustomerActivatedConnectionConfigVar
  | OrganizationActivatedConnectionConfigVar
  | UserActivatedConnectionConfigVar;

/**
 * Root ScopedConfigVars type exposed for augmentation.
 *
 * The expected interface when augmenting is:
 *
 * ```ts
 * interface IntegrationDefinitionScopedConfigVars {
 *   [key: string]: ScopedConfigVar
 * }
 * ```
 *
 */
export interface IntegrationDefinitionScopedConfigVars {}

type CreateScopedConfigVars<TScopedConfigVarMap> = keyof TScopedConfigVarMap extends never
  ? /* Note: This value can never actually be a string, but we need to
     *   introduce this union here so the ConfigVars type will correctly
     *   bottom out to empty when there are no ScopedConfigVars defined.
     */
    { [key: string]: ScopedConfigVar | string }
  : UnionToIntersection<
      keyof TScopedConfigVarMap extends infer TScopedConfigVarName
        ? TScopedConfigVarName extends keyof TScopedConfigVarMap
          ? TScopedConfigVarMap[TScopedConfigVarName] extends ScopedConfigVar
            ? {
                [Key in TScopedConfigVarName]: TScopedConfigVarMap[TScopedConfigVarName];
              }
            : never
          : never
        : never
    >;

export type ScopedConfigVarMap = CreateScopedConfigVars<IntegrationDefinitionScopedConfigVars>;

export const isConnectionScopedConfigVar = (cv: unknown): cv is ScopedConfigVar => {
  if (!cv || typeof cv !== "object" || Array.isArray(cv)) {
    return false;
  }

  if (
    !("dataType" in cv) ||
    (cv.dataType !== "connection" && cv.dataType !== "userScopedConnection")
  ) {
    return false;
  }

  // A declaration carrying a component reference or its own inputs is a connection
  // definition, not a reference to a Scoped Config Variable.
  return (
    !isConnectionDefinitionConfigVar(cv as ConfigVar) &&
    !isConnectionReferenceConfigVar(cv as ConfigVar)
  );
};

/**
 * Whether this connection is scoped to the organization or the customer rather than to
 * a specific person.
 *
 * Only a user-activated connection survives as a config page element. The rest are
 * stripped, because nobody fills them in on the wizard.
 */
export const isOrgOrCustomerActivatedConnection = (
  cv: unknown,
): cv is CustomerActivatedConnectionConfigVar | OrganizationActivatedConnectionConfigVar =>
  isConnectionScopedConfigVar(cv) && !isUserScopedConnectionConfigVar(cv);

/** Whether this config var is a connection each person activates for themselves. */
export const isUserScopedConnectionConfigVar = (
  cv: unknown,
): cv is UserActivatedConnectionConfigVar =>
  Boolean(cv) &&
  typeof cv === "object" &&
  !Array.isArray(cv) &&
  "dataType" in (cv as object) &&
  (cv as { dataType: unknown }).dataType === "userScopedConnection";
