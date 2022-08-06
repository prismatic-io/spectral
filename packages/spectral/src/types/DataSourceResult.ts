import { ObjectSelection, ObjectFieldMap, JSONForm } from "./Inputs";

/** The type of field that is appropriate for rendering the data that is the result of the data source perform function. */
export type DataSourceResultFieldType =
  | "string"
  | "date"
  | "timestamp"
  | "picklist"
  | "schedule"
  | "code"
  | "credential"
  | "boolean"
  | "number"
  | "connection"
  | "objectSelection"
  | "objectFieldMap"
  | "jsonForm";

/** The actual data type of the data that is the result of the data source perform function. */
export type DataSourceResultType =
  | ObjectSelection
  | ObjectFieldMap
  | JSONForm
  | Buffer
  | boolean
  | number
  | string
  | Record<string, unknown>
  | unknown[]
  | unknown;

/** Represents the result of a Data Source action. */
export type DataSourceResult<TDataSourceResultType> = {
  /** The resulting data that is returned from the data source. */
  result: TDataSourceResultType;
  /** Additional data that may be useful for out-of-band processing at a later time. */
  supplementalData?: { data: unknown; contentType: string };
};
