import {
  Inputs,
  ActionInputParameters,
  ActionLogger,
  Customer,
  Instance,
  User,
} from ".";

/** Context provided to the event function containing helpers and contextual data */
export interface TriggerEventFunctionContext {
  logger: ActionLogger;
  customer: Customer;
  instance: Instance;
  user: User;
}

/** Definition of the function to execute when a Trigger Event occurs. */
export type TriggerEventFunction<TInputs extends Inputs> = (
  context: TriggerEventFunctionContext,
  params: ActionInputParameters<TInputs>
) => Promise<void>;
