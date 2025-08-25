import { isConnectionDefinitionConfigVar, isConnectionReferenceConfigVar } from "./ConfigVars";
import type { ConfigVar } from ".";
import type { UnionToIntersection } from "./utils";

export type CustomerActivatedConnectionConfigVar = {
  dataType: "connection";
  stableKey: string;
};

export type OrganizationActivatedConnectionConfigVar = {
  dataType: "connection";
  stableKey: string;
};

/* More types may eventually be added to this union. */
export type ScopedConfigVar =
  | CustomerActivatedConnectionConfigVar
  | OrganizationActivatedConnectionConfigVar;

/**
 * Root ScopedConfigVars type exposed for augmentation.
 *
 * The expected interface when augmenting is:
 *
 * ```ts
 * interface IntegrationDefinitionScopedConfigVars {
 *   [key: string]: OrganizationActivatedConnectionConfigVar
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
    { [key: string]: OrganizationActivatedConnectionConfigVar | string }
  : UnionToIntersection<
      keyof TScopedConfigVarMap extends infer TScopedConfigVarName
        ? TScopedConfigVarName extends keyof TScopedConfigVarMap
          ? TScopedConfigVarMap[TScopedConfigVarName] extends OrganizationActivatedConnectionConfigVar
            ? {
                [Key in TScopedConfigVarName]: TScopedConfigVarMap[TScopedConfigVarName];
              }
            : never
          : never
        : never
    >;

export type ScopedConfigVarMap = CreateScopedConfigVars<IntegrationDefinitionScopedConfigVars>;

export const isConnectionScopedConfigVar = (
  cv: unknown,
): cv is OrganizationActivatedConnectionConfigVar => {
  if (!cv || typeof cv !== "object" || Array.isArray(cv)) {
    return false;
  }

  if (!("dataType" in cv) || cv.dataType !== "connection") {
    return false;
  }

  return (
    !isConnectionDefinitionConfigVar(cv as ConfigVar) &&
    !isConnectionReferenceConfigVar(cv as ConfigVar)
  );
};
