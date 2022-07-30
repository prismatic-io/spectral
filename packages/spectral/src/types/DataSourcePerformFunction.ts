import {
  Inputs,
  DataSourceResult,
  DataSourceResultType,
  ActionInputParameters,
  ActionContext,
} from ".";

/** Definition of the function to perform when a Data Source is invoked. */
export type DataSourcePerformFunction<
  T extends Inputs,
  TResult extends DataSourceResult<DataSourceResultType>
> = (
  context: ActionContext,
  params: ActionInputParameters<T>
) => Promise<TResult>;
