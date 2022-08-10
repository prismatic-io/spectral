import {
  ActionDisplayDefinition,
  DataSourcePerformFunction,
  Inputs,
  DataSourceResult,
  DataSourceResultType,
  DataSourceResultFieldType,
} from ".";

/**
 * DataSourceDefinition is the type of the object that is passed in to `dataSource` function to
 * define a component Data Source.
 */
export interface DataSourceDefinition<
  TInputs extends Inputs,
  TDataSourceResult extends DataSourceResult<DataSourceResultType>
> {
  /** Defines how the Data Source is displayed in the Prismatic interface. */
  display: ActionDisplayDefinition;
  /** Function to perform when this Data Source is invoked. */
  perform: DataSourcePerformFunction<TInputs, TDataSourceResult>;
  /** Field type of the data produced by the data source perform function. */
  resultFieldType: DataSourceResultFieldType;
  /** InputFields to present in the Prismatic interface for configuration of this Data Source. */
  inputs: TInputs;
  /** An example of the payload outputted by this Data Source. */
  examplePayload?: Awaited<ReturnType<this["perform"]>>;
  /** Specifies the name of a Data Source in this Component which can provide additional details about the content for this Data Source, such as example values when selecting particular API object fields. */
  detailDataSource?: string;
}
