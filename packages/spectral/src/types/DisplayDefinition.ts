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

interface ExtraDisplayDefinitionFields {
  /** Path to icon to use for this Component. Path should be relative to the built component source. */
  iconPath: string;
  /** Category of the Component. */
  category?: string;
}

/** Component extensions for display properties. */
export type ComponentDisplayDefinition<T extends boolean> = T extends true
  ? DisplayDefinition & Required<ExtraDisplayDefinitionFields>
  : DisplayDefinition & ExtraDisplayDefinitionFields;

/** Action-specific Display attributes. */
export interface ActionDisplayDefinition extends DisplayDefinition {
  /** Directions to help guide the user if additional configuration is required for this Action. */
  directions?: string;
  /** Indicate that this Action is important and/or commonly used from the parent Component. Should be enabled sparingly. */
  important?: boolean;
}
