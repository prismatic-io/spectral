import {
  Inputs,
  DataSourceResult,
  DataSourceType,
  ActionInputParameters,
  ActionLogger,
  CustomerAttributes,
  InstanceAttributes,
  UserAttributes,
} from ".";

/** Context provided to perform method containing helpers and contextual data */
export interface DataSourceContext {
  logger: ActionLogger;
  customer: CustomerAttributes;
  instance: InstanceAttributes;
  user: UserAttributes;
}

/** Definition of the function to perform when a Data Source is invoked. */
export type DataSourcePerformFunction<
  TInputs extends Inputs,
  TDataSourceType extends DataSourceType
> = (
  context: DataSourceContext,
  params: ActionInputParameters<TInputs>
) => Promise<DataSourceResult<TDataSourceType>>;
