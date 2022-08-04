import {
  Inputs,
  DataSourceResult,
  DataSourceResultType,
  ActionInputParameters,
} from ".";

/** Definition of the function to perform when a Data Source is invoked. */
export type DataSourcePerformFunction<
  T extends Inputs,
  TResult extends DataSourceResult<DataSourceResultType>
> = (params: ActionInputParameters<T>) => Promise<TResult>;
