/** Represents an HTTP Response, which are required for some Triggers. */
export interface HttpResponse {
  /**
   * HTTP status code to return from a trigger. See
   * https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status.
   */
  statusCode: number;
  /** The MIME type (`content-type` header) of the trigger's response. */
  contentType: string;
  /** Custom headers to return in the trigger's response. */
  headers?: {
    [key: string]: string;
  };
  /** The trigger's response body. When omitted, defaults to `{ "executionId": "SOME-ID" }` */
  body?: string;
}
