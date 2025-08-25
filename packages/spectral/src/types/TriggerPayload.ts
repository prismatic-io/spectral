import type {
  InstanceAttributes,
  CustomerAttributes,
  UserAttributes,
  IntegrationAttributes,
  FlowAttributes,
} from ".";

/** Represents a Trigger Payload, which is data passed into a Trigger to invoke an Integration execution. */
export interface TriggerPayload {
  /** The headers sent in the webhook request. */
  headers: {
    [key: string]: string;
  };
  /** The search parameters included in the URL of the webhook request. */
  queryParameters: {
    [key: string]: string;
  };
  /** The unparsed body of the webhook request. */
  rawBody: {
    data: unknown;
    contentType?: string;
  };
  /** The parsed body of the webhook request. */
  body: {
    data: unknown;
    contentType?: string;
  };
  /** Extended path information from the webhook trigger. */
  pathFragment: string;
  /** The webhook URLs assigned to this integration's flows upon instance deploy. */
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
  customer: CustomerAttributes;
  /** Contains attributes of the Instance that is being executed. */
  instance: InstanceAttributes;
  /** Contains attributes of the User for whom a User Level Configuration is being used. */
  user: UserAttributes;
  /** Contains attributes of the Integration that is being executed. */
  integration: IntegrationAttributes;
  /** Contains attributes of the Flow that is being executed. */
  flow: FlowAttributes;
  /** The time in UTC that execution started. */
  startedAt: string;
  /** Determines whether the execution will run in debug mode. */
  globalDebug: boolean;
}
