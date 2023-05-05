import {
  Inputs,
  DataSourceResult,
  DataSourceType,
  ActionInputParameters,
  ActionLogger,
  Customer,
  Instance,
  User,
} from ".";

/** Context provided to perform method containing helpers and contextual data */
export interface DataSourceContext {
  logger: ActionLogger;
  customer: Customer;
  instance: Instance;
  user: User;
}

/** Definition of the function to perform when a Data Source is invoked. */
export type DataSourcePerformFunction<
  TInputs extends Inputs,
  TDataSourceType extends DataSourceType
> = (
  context: DataSourceContext,
  params: ActionInputParameters<TInputs>
) => Promise<DataSourceResult<TDataSourceType>>;
