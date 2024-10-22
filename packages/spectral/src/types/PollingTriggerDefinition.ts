import type {
  ActionDisplayDefinition,
  TriggerPerformFunction,
  TriggerEventFunction,
  Inputs,
  TriggerResult,
  ConfigVarResultCollection,
  TriggerPayload,
  ActionDefinition,
  ActionPerformReturn,
} from ".";

export type PollingTriggerFilterableValue = Date | number;
export type PolledResource = Record<string, any>;
export type PollingValidAction = ActionDefinition & { allowsBranching?: false };

/**
 * PollingTriggerDefinition is the type of the object that is passed in to `pollingTrigger` function to
 * define a component trigger.
 */
export interface PollingTriggerDefinition<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TResult extends TriggerResult<false, TriggerPayload>,
  TResource extends PolledResource,
> {
  /** Defines how the Trigger is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** The action that this trigger will poll with. */
  action: PollingValidAction;
  /** The return value of the filterBy will be used by polling trigger's default filter methods. */
  filterBy: (resource: TResource) => PollingTriggerFilterableValue;
  /** The return value of getPolledResources should be the array of records to be filtered. The default is the "data" key of the action's return value. */
  getPolledResources?: (actionResponse: ActionPerformReturn<boolean, any>) => PolledResource[];
  /** Function to perform when this Trigger is invoked. A default perform will be provided for most polling triggers but defining this allows for custom behavior. */
  perform?: TriggerPerformFunction<TInputs, TConfigVars, false, TResult>;
  /** Function to execute when an Instance of an Integration with a Flow that uses this Trigger is deployed. */
  onInstanceDeploy?: TriggerEventFunction<TInputs, TConfigVars>;
  /** Function to execute when an Instance of an Integration with a Flow that uses this Trigger is deleted. */
  onInstanceDelete?: TriggerEventFunction<TInputs, TConfigVars>;
  /** InputFields to present in the Prismatic interface for configuration of this Trigger. */
  inputs?: TInputs;
}
