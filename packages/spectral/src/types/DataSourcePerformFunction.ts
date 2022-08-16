import {
  Inputs,
  DataSourceResult,
  DataSourceType,
  ActionInputParameters,
} from ".";

/** Definition of the function to perform when a Data Source is invoked. */
export type DataSourcePerformFunction<
  TInputs extends Inputs,
  TDataSourceType extends DataSourceType
> = (
  params: ActionInputParameters<TInputs>
) => Promise<DataSourceResult<TDataSourceType>>;
