import { ConnectionDefinition } from "./ConnectionDefinition";
import { ObjectSelection, ObjectFieldMap, JSONForm } from "./Inputs";

/** The type of field that is appropriate for rendering the data that is the result of the data source perform function. */
type DataSourceTypeMap = {
  string: string;
  date: string;
  timestamp: string;
  picklist: string[];
  schedule: { value: string };
  code: string;
  credential: unknown; // DEPRECATED
  boolean: boolean;
  number: number;
  connection: ConnectionDefinition;
  objectSelection: ObjectSelection;
  objectFieldMap: ObjectFieldMap;
  jsonForm: JSONForm;
};

export type DataSourceType = keyof DataSourceTypeMap;

export type DataSourceResultType = DataSourceTypeMap[DataSourceType];

/** Represents the result of a Data Source action. */
export type DataSourceResult<TDataSourceType extends DataSourceType> = {
  /** The resulting data that is returned from the data source. */
  result: DataSourceTypeMap[TDataSourceType];
  /** Additional data that may be useful for out-of-band processing at a later time.
   *  NOTE: This is only available when the Data Source is called as part of fetching
   *  contents for a Configuration Wizard Page. */
  supplementalData?: { data: unknown; contentType: string };
};
