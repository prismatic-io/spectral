/** Binary data payload. */
export interface DataPayload {
  /** Raw binary data as a Buffer. */
  data: Buffer;
  /** Content type of data contained within this payload. */
  contentType: string;
  /** Suggested extension to use when writing the data. */
  suggestedExtension?: string;
}
