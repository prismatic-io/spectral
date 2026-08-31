import type { ConfigVar, ConnectionConfigVar } from "./ConfigVars";
import type {
  CustomerActivatedConnectionConfigVar,
  OrganizationActivatedConnectionConfigVar,
  UserActivatedConnectionConfigVar,
} from "./ScopedConfigVars";
import type { UnionToIntersection } from "./utils";

/**
 * Root ConfigPages type exposed for augmentation.
 *
 * The expected interface when augmenting is:
 *
 * ```ts
 * interface IntegrationDefinitionConfigPages {
 *   [key: string]: ConfigPage
 * }
 * ```
 *
 */
export interface IntegrationDefinitionConfigPages {}

/**
 * Root UserLevelConfigPages type exposed for augmentation.
 *
 * The expected interface when augmenting is:
 *
 * ```ts
 * interface IntegrationDefinitionUserLevelConfigPages {
 *   [key: string]: UserLevelConfigPage
 * }
 * ```
 *
 */
export interface IntegrationDefinitionUserLevelConfigPages {}

/**
 * What an ordinary config page may contain.
 *
 * A user-activated connection is excluded. It is only supported on a user level config
 * page; anywhere else it emits as an ordinary shared connection, so the author would
 * lose the feature with no error. The convert layer enforces this at build time.
 */
export type ConfigPageElement = string | Exclude<ConfigVar, UserActivatedConnectionConfigVar>;

/**
 * What a user level config page may contain.
 *
 * Only the per-person connection kind. Every other kind is activated once by the
 * organization or the customer, so putting one here asks each person for a credential
 * that is not theirs to give. Config vars that are not connections are unaffected.
 * The convert layer enforces this at build time.
 */
export type UserLevelConfigPageElement =
  | string
  | Exclude<
      ConfigVar,
      | ConnectionConfigVar
      | CustomerActivatedConnectionConfigVar
      | OrganizationActivatedConnectionConfigVar
    >;

/** An element on a page of either kind, for code that walks both wizards at once. */
export type AnyConfigPageElement = ConfigPageElement | UserLevelConfigPageElement;

type CreateConfigPages<TIntegrationDefinitionConfigPages, TPage> =
  keyof TIntegrationDefinitionConfigPages extends never
    ? { [key: string]: TPage }
    : UnionToIntersection<
        keyof TIntegrationDefinitionConfigPages extends infer TPageName
          ? TPageName extends keyof TIntegrationDefinitionConfigPages
            ? TIntegrationDefinitionConfigPages[TPageName] extends TPage
              ? {
                  [Key in TPageName]: TIntegrationDefinitionConfigPages[TPageName];
                }
              : never
            : never
          : never
      >;

export type ConfigPages = CreateConfigPages<IntegrationDefinitionConfigPages, ConfigPage>;
export type UserLevelConfigPages = CreateConfigPages<
  IntegrationDefinitionUserLevelConfigPages,
  UserLevelConfigPage
>;

/** Defines attributes of a Config Wizard Page used when deploying an Instance of an Integration. */
export interface ConfigPage {
  /** Elements included on this Config Page. */
  elements: Record<string, ConfigPageElement>;
  /** Specifies an optional tagline for this Config Page. */
  tagline?: string;
}

/**
 * Defines attributes of a Config Wizard Page each person configures for themselves.
 *
 * Separate from `ConfigPage` so a user-activated connection is accepted here and refused
 * everywhere else.
 */
export interface UserLevelConfigPage {
  /** Elements included on this Config Page. */
  elements: Record<string, UserLevelConfigPageElement>;
  /** Specifies an optional tagline for this Config Page. */
  tagline?: string;
}
