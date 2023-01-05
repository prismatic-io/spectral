/**
 * Types in this file describe how an action or component should appear in the Prismatic web app.
 */

/** Base definition of Display properties. */
interface DisplayDefinition {
  /** Label/name to display. */
  label: string;
  /** Description to display to the user. */
  description: string;
}

type PublicComponentCategory =
  | "Application Connectors"
  | "Data Platforms"
  | "Helpers"
  | "Logic"
  | "Triggers";

interface ExtraDisplayDefinitionFields<TPublic extends boolean> {
  /** Path to icon to use for this Component. Path should be relative to the built component source. */
  iconPath: string;
  /** Category of the Component. */
  category?: TPublic extends true ? PublicComponentCategory : string;
}

/** Component extensions for display properties. */
export type ComponentDisplayDefinition<TPublic extends boolean> =
  TPublic extends true
    ? DisplayDefinition & Required<ExtraDisplayDefinitionFields<TPublic>>
    : DisplayDefinition & ExtraDisplayDefinitionFields<TPublic>;

/** Action-specific Display attributes. */
export interface ActionDisplayDefinition extends DisplayDefinition {
  /** Directions to help guide the user if additional configuration is required for this Action. */
  directions?: string;
  /** Indicate that this Action is important and/or commonly used from the parent Component. Should be enabled sparingly. */
  important?: boolean;
}
