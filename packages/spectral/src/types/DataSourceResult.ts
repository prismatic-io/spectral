/** Represents the result of a Data Source action. */
export type DataSourceResult<ContentData> = {
  /** The data that will be used as content. */
  content: ContentData;
  /** Additional data that may be useful for out-of-band processing at a later time. */
  supplementalData?: { data: unknown; contentType: string };
};
