import {
  Inputs,
  DataSourceResult,
  DataSourceType,
  ActionInputParameters,
  ActionContext,
} from ".";

/** Definition of the function to perform when a Data Source is invoked. */
export type DataSourcePerformFunction<
  T extends Inputs,
  TResult extends DataSourceResult<DataSourceType>
> = (
  context: ActionContext,
  params: ActionInputParameters<T>
) => Promise<TResult>;
