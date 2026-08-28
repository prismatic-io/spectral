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
 * A user-activated connection is excluded because it is activated by each person
 * individually, which only a user level config page supports. Anywhere else it is
 * emitted as an ordinary shared connection – byte for byte what a non-user-scoped
 * declaration produces – so the author would lose the feature with no error. This is
 * the canonical statement of that rule; the convert layer enforces it at build time.
 */
export type ConfigPageElement = string | Exclude<ConfigVar, UserActivatedConnectionConfigVar>;

/**
 * What a user level config page may contain.
 *
 * Every connection kind except the per-person one is excluded. A page on this wizard is
 * shown to each individual, and any other kind is activated once – by the organization
 * or by the customer – so putting one here asks every person for something that is not
 * theirs to give, and asks it repeatedly. Config vars that are not
 * connections are unaffected: a per-person string or picklist is a real thing to collect.
 *
 * The mirror of `ConfigPageElement`, and stated the same way: the type is the canonical
 * rule and the convert layer enforces it at build time, so a JavaScript author hits it
 * too.
 */
export type UserLevelConfigPageElement =
  | string
  | Exclude<
      ConfigVar,
      | ConnectionConfigVar
      | CustomerActivatedConnectionConfigVar
      | OrganizationActivatedConnectionConfigVar
    >;

/**
 * An element on a page of either kind.
 *
 * For the code that walks both wizards at once. The two element types are deliberately
 * different sets now, so a shared consumer has no single narrower type to reach for.
 */
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
 * Separate from `ConfigPage` so a user-activated connection can be accepted here and
 * refused everywhere else.
 */
export interface UserLevelConfigPage {
  /** Elements included on this Config Page. */
  elements: Record<string, UserLevelConfigPageElement>;
  /** Specifies an optional tagline for this Config Page. */
  tagline?: string;
}
