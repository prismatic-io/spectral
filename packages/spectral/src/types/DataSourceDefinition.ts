import type { DataSourcePerformFunction } from "./DataSourcePerformFunction";
import type { DataSourceType } from "./DataSourceResult";
import type { ActionDisplayDefinition } from "./DisplayDefinition";
import type { ConfigVarResultCollection, Inputs } from "./Inputs";

/**
 * DataSourceDefinition is the type of the object that is passed in to `dataSource` function to
 * define a data source. See
 * https://prismatic.io/docs/custom-connectors/data-sources/
 */
export interface DataSourceDefinition<
  TInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection,
  TDataSourceType extends DataSourceType,
> {
  /** Defines how the data source is displayed in the Prismatic UI. */
  display: ActionDisplayDefinition;
  /** Function to perform when this data source is invoked; fetches data from an external API and returns data to be presented in an integration config wizard UI. */
  perform: DataSourcePerformFunction<TInputs, TConfigVars, TDataSourceType>;
  /** The type of UI that will present the data the `perform` function returns. */
  dataSourceType: TDataSourceType;
  /**
   * The inputs to present a low-code integration builder. Values of these inputs
   * are passed to the `perform` function when the action is invoked.
   */
  inputs: TInputs;
  /** An example of the payload outputted by this data source. Must match the type of the object that the `perform` function returns. */
  examplePayload?: Awaited<ReturnType<this["perform"]>>;
  /** Specifies the name of a data source in this component which can provide additional details about the content for this data source, such as example values when selecting particular API object fields. */
  detailDataSource?: string;
}
