/** Represents a Trigger Payload, which is data passed into a Trigger to invoke an Integration execution. */
export interface TriggerPayload {
  headers: {
    [key: string]: string;
  };
  queryParameters: {
    [key: string]: string;
  };
  rawBody: {
    data: unknown;
    contentType?: string;
  };
  body: {
    data: unknown;
    contentType?: string;
  };
  webhookUrls: {
    [key: string]: string;
  };
  customer: {
    externalId: string | null;
    name: string | null;
  };
}
