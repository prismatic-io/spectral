/** Contains attributes of the Customer for whom an Instance is being executed. */
export interface CustomerAttributes {
  /** The programmatic ID of a customer */
  id: string;
  /**
   * The external ID you set for a customer. See
   * https://prismatic.io/docs/customers/managing-customers/#customer-external-ids
   */
  externalId: string;
  /** The name of the customer */
  name: string;
}
