/** Represents an HTTP Response, which are required for some Triggers. */
export interface HttpResponse {
  statusCode: number;
  contentType: string;
  headers?: {
    [key: string]: string;
  };
  body?: string;
}
