import {
  ObjectSelection,
  ObjectFieldMap,
  InputFieldDefaultMap,
} from "./Inputs";

/** The type of field that is appropriate for rendering the data that is the result of the data source perform function. */
export type DataSourceResultFieldType = keyof typeof InputFieldDefaultMap;

/** The actual data type of the data that is the result of the data source perform function. */
export type DataSourceResultType =
  | ObjectSelection
  | ObjectFieldMap
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
