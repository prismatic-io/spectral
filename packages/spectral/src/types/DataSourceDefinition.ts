import {
  ActionDisplayDefinition,
  DataSourcePerformFunction,
  Inputs,
  DataSourceResult,
  DataSourceType,
} from ".";

/**
 * DataSourceDefinition is the type of the object that is passed in to `dataSource` function to
 * define a component Data Source.
 */
export interface DataSourceDefinition<
  TInputs extends Inputs,
  TDataSourceResult extends DataSourceResult<DataSourceType>
> {
  /** Defines how the Data Source is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** Function to perform when this Data Source is invoked. */
  perform: DataSourcePerformFunction<TInputs, TDataSourceResult>;
  /** InputFields to present in the Prismatic interface for configuration of this Data Source. */
  inputs: TInputs;
  /** An example of the payload outputted by this Data Source. */
  examplePayload?: Awaited<ReturnType<this["perform"]>>;
}
