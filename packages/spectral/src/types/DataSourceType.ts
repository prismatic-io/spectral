export type ObjectSelection = {
  key: string;
  label?: string;
  fields: {
    key: string;
    label?: string;
  }[];
}[];

export type ObjectFieldMap = {
  key: string;
  label?: string;
  value: {
    objectKey: string;
    objectLabel?: string;
    fieldKey: string;
    fieldLabel?: string;
  };
}[];

export type DataSourceType =
  | ObjectSelection
  | ObjectFieldMap
  | Buffer
  | boolean
  | number
  | string
  | Record<string, unknown>
  | unknown[]
  | unknown;
