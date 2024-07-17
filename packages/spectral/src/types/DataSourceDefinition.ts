import {
  ActionDisplayDefinition,
  DataSourcePerformFunction,
  Inputs,
  DataSourceType,
  ConfigVarResultCollection,
} from ".";

/**
 * DataSourceDefinition is the type of the object that is passed in to `dataSource` function to
 * define a component Data Source.
 */
export interface DataSourceDefinition<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TDataSourceType extends DataSourceType,
> {
  /** Defines how the Data Source is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** Function to perform when this Data Source is invoked; fetches data from the data source. */
  perform: DataSourcePerformFunction<TInputs, TConfigVars, TDataSourceType>;
  /** The type of data that this Data Source represents. */
  dataSourceType: TDataSourceType;
  /** InputFields to present in the Prismatic interface for configuration of this Data Source. */
  inputs: TInputs;
  /** An example of the payload outputted by this Data Source. */
  examplePayload?: Awaited<ReturnType<this["perform"]>>;
  /** Specifies the name of a Data Source in this Component which can provide additional details about the content for this Data Source, such as example values when selecting particular API object fields. */
  detailDataSource?: string;
}
