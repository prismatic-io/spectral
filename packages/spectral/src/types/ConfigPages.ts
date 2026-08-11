import type { ConfigVar } from "./ConfigVars";
import type { UserActivatedConnectionConfigVar } from "./ScopedConfigVars";
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

/** What a user level config page may contain: anything an ordinary page may, plus a
 * connection each person activates for themselves. */
export type UserLevelConfigPageElement = string | ConfigVar;

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
