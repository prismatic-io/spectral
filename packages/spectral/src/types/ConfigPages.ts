import type {
  ConfigVar,
  ConnectionConfigVar,
  DataSourceConfigVar,
  StandardConfigVar,
} from "./ConfigVars";
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
 * A connection the integration defines, or references from a component, belongs here:
 * nobody has supplied its credential in advance, which is the reason this wizard
 * exists. So does the per-person kind, and any config var that is not a connection.
 *
 * The two reusable kinds do not. Their credential is supplied once - by the
 * organization or by the customer - so a page shown to each individual cannot ask
 * for it.
 *
 * Stated as what it accepts rather than as an `Exclude` of what it does not, which
 * looks equivalent and is not: the reusable kinds are
 * `{ dataType: "connection"; stableKey: string }`, and every other connection kind is
 * assignable to that, so excluding them takes the rest with them.
 */
export type UserLevelConfigPageElement =
  | string
  | StandardConfigVar
  | DataSourceConfigVar
  | ConnectionConfigVar
  | UserActivatedConnectionConfigVar;

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

/**
 * Every kind of config var is either collectable on a user level page or one of the
 * two reusable kinds that page refuses.
 *
 * Listing what the page accepts is the only formulation that works - see the note on
 * `UserLevelConfigPageElement` - but a list does not follow `ConfigVar` when a kind is
 * added to it. This fails the build in that case, so the new kind has to be given an
 * answer rather than silently becoming un-collectable.
 */
type UnclassifiedConfigVar = Exclude<
  ConfigVar,
  | UserLevelConfigPageElement
  | CustomerActivatedConnectionConfigVar
  | OrganizationActivatedConnectionConfigVar
>;
type AssertNever<T extends never> = T;
type _EveryConfigVarIsClassified = AssertNever<UnclassifiedConfigVar>;
