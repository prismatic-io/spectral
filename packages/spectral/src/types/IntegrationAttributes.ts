/** Contains attributes of the integration that is being executed. */
export interface IntegrationAttributes {
  /** Programmatic ID of the integration being executed */
  id: string;
  /** Name of the integration being executed */
  name: string;
  /** ID of the version of the integration being executed */
  versionSequenceId: string;
  externalVersion: string;
}
