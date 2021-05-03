/** Base definition of Display properties. */
interface DisplayDefinition {
  /** Label/name to display. */
  label: string;
  /** Description to display to the user. */
  description: string;
}

/** Component extensions for display properties. */
export interface ComponentDisplayDefinition extends DisplayDefinition {
  /** Path to icon to use for this Component. Path should be relative to component roto index. */
  iconPath?: string;
}

/** Action-specific Display attributes. */
export interface ActionDisplayDefinition extends DisplayDefinition {
  /** Directions to help guide the user if additional configuration is required for this Action. */
  directions?: string;
  /** Indicate that this Action is important and/or commonly used from the parent Component. Should be enabled sparingly. */
  important?: boolean;
}
