import {
  ActionDefinition,
  ConnectionDefinition,
  ComponentDisplayDefinition,
  TriggerDefinition,
  DataSourceDefinition,
} from ".";
import { PollingTriggerDefinition } from "./PollingTriggerDefinition";

export type ErrorHandler = (error: unknown) => unknown;

export interface ComponentHooks {
  /**
   * Defines a global error handler that automatically wraps the component's action/trigger
   * perform functions. See
   * https://prismatic.io/docs/custom-connectors/error-handling/#global-error-handlers
   */
  error?: ErrorHandler;
}

/** Defines attributes of a component. */
export type ComponentDefinition<TPublic extends boolean, TKey extends string> = {
  /** Specifies a unique programmatic key for this component. */
  key: TKey;
  /**
   * Specifies if this component is available for all organizations or only your own.
   * Only Prismatic public components can specify 'true'
   * @default false
   */
  public?: TPublic;
  /** Defines how the component is displayed in the Prismatic UI. */
  display: ComponentDisplayDefinition<TPublic>;
  /**
   * Specifies the supported Actions of this component. See
   * https://prismatic.io/docs/custom-connectors/actions/
   */
  actions?: Record<string, ActionDefinition<any, any, boolean, any>>;
  /**
   * Specifies the supported triggers of this component. See
   * https://prismatic.io/docs/custom-connectors/triggers/
   */
  triggers?: Record<
    string,
    | TriggerDefinition<any, any, boolean, any>
    | PollingTriggerDefinition<any, any, any, any, any, any>
  >;
  /**
   * Specifies the supported data sources of this component. See
   * https://prismatic.io/docs/custom-connectors/data-sources/
   */
  dataSources?: Record<string, DataSourceDefinition<any, any, any>>;
  /**
   * Specifies the supported connections of this component. See
   * https://prismatic.io/docs/custom-connectors/connections/
   */
  connections?: ConnectionDefinition[];
  /**
   * Hooks (error handler) for this component. See
   * https://prismatic.io/docs/custom-connectors/error-handling/
   */
  hooks?: ComponentHooks;
} & (TPublic extends true
  ? {
      /** The URL for this component's documentation. */
      documentationUrl: `https://prismatic.io/docs/components/${TKey}/`;
    }
  : {
      documentationUrl?: string;
    });
