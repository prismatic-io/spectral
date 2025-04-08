import {
  Inputs,
  DataSourceResult,
  DataSourceType,
  ActionInputParameters,
  ConfigVarResultCollection,
  ActionContext,
} from ".";

/** Context provided to perform method containing helpers and contextual data. */
export type DataSourceContext<
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
> = Pick<ActionContext<TConfigVars>, "logger" | "customer" | "instance" | "user" | "configVars">;

/** Definition of the function to perform when a Data Source is invoked. */
export type DataSourcePerformFunction<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TDataSourceType extends DataSourceType,
> = (
  context: DataSourceContext<TConfigVars>,
  params: ActionInputParameters<TInputs>,
) => Promise<DataSourceResult<TDataSourceType>>;
