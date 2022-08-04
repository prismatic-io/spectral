import { Instance, Customer } from ".";

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
  /** Extended path information from the webhook trigger */
  pathFragment: string;
  /** The webhook URLs assigned to this integration's flows upon instance deploy */
  webhookUrls: {
    [key: string]: string;
  };
  /** The optional API keys assigned to the flows of this integration. These may be unique per integration instance and per flow. */
  webhookApiKeys: {
    [key: string]: string[];
  };
  /** The URL that was used to invoke the execution. */
  invokeUrl: string;
  executionId: string;
  /** Contains attributes of the Customer for whom an Instance is being executed. */
  customer: Customer;
  /** Contains attributes of the Instance that is being executed. */
  instance: Instance;
}
