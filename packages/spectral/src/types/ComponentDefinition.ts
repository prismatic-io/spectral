import {
  ActionDefinition,
  ConnectionDefinition,
  ComponentDisplayDefinition,
  TriggerDefinition,
} from ".";

export type ErrorHandler = (error: unknown) => unknown;

export interface ComponentHooks {
  /** Defines a global error handler that automatically wraps the component's action/trigger perform functions. */
  error?: ErrorHandler;
}

/** Defines attributes of a Component. */
export type ComponentDefinition<TPublic extends boolean> = {
  /** Specifies unique key for this Component. */
  key: string;
  /** Specifies if this Component is available for all Organizations or only your own @default false */
  public?: TPublic;
  /** Defines how the Component is displayed in the Prismatic interface. */
  display: ComponentDisplayDefinition<TPublic>;
  /** Specifies the supported Actions of this Component. */
  actions?: Record<string, ActionDefinition<any, boolean, any>>;
  /** Specifies the supported Triggers of this Component. */
  triggers?: Record<string, TriggerDefinition<any, boolean, any>>;
  /** Specifies the supported Connections of this Component. */
  connections?: ConnectionDefinition[];
  /** Hooks */
  hooks?: ComponentHooks;
} & (TPublic extends true
  ? {
      /** Specified the URL for the Component Documentation. */
      documentationUrl: string;
    }
  : unknown);
