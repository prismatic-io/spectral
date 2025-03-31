/**
 * Contains attributes of the User whose user-level configuration is being used. See
 * https://prismatic.io/docs/integrations/config-wizard/user-level-configuration/
 */
export interface UserAttributes {
  /** Programmatic ID of the user whose user-level configuration is being used */
  id: string;
  /** The email address (or embedded ID) of the user whose user-level configuration is being used */
  email: string;
  /** The name of the user whose user-level configuration is being used */
  name: string;
  /**
   * The external ID you assign to the user whose user-level configuration is being used. See
   * https://prismatic.io/docs/embed/authenticate-users/#create-and-sign-a-jwt
   */
  externalId: string;
}
