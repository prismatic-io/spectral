import { Component } from "./server-types";
import {
  ActionPerformReturn,
  ActionDefinition,
  ConnectionDefinition,
  TriggerDefinition,
  TriggerResult,
} from ".";

export type ComponentDefinition<T extends boolean> = Omit<
  Component<T>,
  "actions" | "triggers" | "connections"
> & {
  actions?: Record<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ActionDefinition<any, boolean, ActionPerformReturn<boolean, any>>
  >;
  triggers?: Record<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TriggerDefinition<any, boolean, TriggerResult<boolean>>
  >;
  connections?: ConnectionDefinition[];
};
