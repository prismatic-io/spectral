import type { ConfigVar } from ".";
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
 *   [key: string]: ConfigPage
 * }
 * ```
 *
 */
export interface IntegrationDefinitionUserLevelConfigPages {}

export type ConfigPageElement = string | ConfigVar;

type CreateConfigPages<TIntegrationDefinitionConfigPages> =
  keyof TIntegrationDefinitionConfigPages extends never
    ? { [key: string]: ConfigPage }
    : UnionToIntersection<
        keyof TIntegrationDefinitionConfigPages extends infer TPageName
          ? TPageName extends keyof TIntegrationDefinitionConfigPages
            ? TIntegrationDefinitionConfigPages[TPageName] extends ConfigPage
              ? {
                  [Key in TPageName]: TIntegrationDefinitionConfigPages[TPageName];
                }
              : never
            : never
          : never
      >;

export type ConfigPages = CreateConfigPages<IntegrationDefinitionConfigPages>;
export type UserLevelConfigPages = CreateConfigPages<IntegrationDefinitionUserLevelConfigPages>;

/** Defines attributes of a Config Wizard Page used when deploying an Instance of an Integration. */
export interface ConfigPage {
  /** Elements included on this Config Page. */
  elements: Record<string, ConfigPageElement>;
  /** Specifies an optional tagline for this Config Page. */
  tagline?: string;
}
