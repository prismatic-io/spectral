import type { ConnectionDisplayDefinition, ConnectionInput, OnPremConnectionInput } from ".";

export enum OAuth2Type {
  /**
   * This connection uses the OAuth 2.0 client credentials flow. See
   * https://prismatic.io/docs/integrations/connections/oauth2/client-credentials-grant-type/
   */
  ClientCredentials = "client_credentials",
  /**
   * This connection uses the OAuth 2.0 auth code flow. See
   * https://prismatic.io/docs/integrations/connections/oauth2/authorization-code-grant-type/
   */
  AuthorizationCode = "authorization_code",
}

export enum OAuth2PkceMethod {
  Plain = "plain",
  S256 = "S256",
}

interface BaseConnectionDefinition {
  /* The programmatic key of this connection. */
  key: string;
  /* How the connection should be presented in the Prismatic UI. */
  display: ConnectionDisplayDefinition;
  /**
   * If this connection implements OAuth 2.0, specify which flavor of OAuth 2.0. See
   * https://prismatic.io/docs/custom-connectors/connections/#writing-oauth-20-connections
   */
  oauth2Type?: OAuth2Type;
}

export interface DefaultConnectionDefinition extends BaseConnectionDefinition {
  inputs: {
    [key: string]: ConnectionInput;
  };
}

export interface OnPremConnectionDefinition extends BaseConnectionDefinition {
  inputs: {
    /**
     * When on-prem is enabled for this connection, the `host` value will be
     * overwritten with a local endpoint for the established on-prem tunnel. See
     * https://prismatic.io/docs/integrations/connections/on-prem-agent/#supporting-on-prem-connections-in-a-custom-connector
     */
    host: OnPremConnectionInput;
    /**
     * When on-prem is enabled for this connection, the `port` value will be
     * overwritten with a local port for the established on-prem tunnel. See
     * https://prismatic.io/docs/integrations/connections/on-prem-agent/#supporting-on-prem-connections-in-a-custom-connector
     */
    port: OnPremConnectionInput;
    [key: string]: ConnectionInput;
  };
}

interface OAuth2Config {
  overrideGrantType?: string;
  allowedTokenParams?: string[];
}

export interface OAuth2UrlOverrides {
  /**
   * Custom URI where users should be sent on OAuth success. See
   * https://prismatic.io/docs/integrations/connections/oauth2/custom-redirects/
   */
  oAuthSuccessRedirectUri?: string;
  /**
   * Custom URI where users should be sent on OAuth failure. See
   * https://prismatic.io/docs/integrations/connections/oauth2/custom-redirects/
   */
  oAuthFailureRedirectUri?: string;
}

interface OAuth2AuthorizationCodeConnectionDefinition extends BaseConnectionDefinition {
  oauth2Type: OAuth2Type.AuthorizationCode;
  oauth2Config?: OAuth2Config & OAuth2UrlOverrides;
  /**
   * The PKCE method (S256 or plain) that this OAuth 2.0 connection uses (if any). See
   * https://prismatic.io/docs/custom-connectors/connections/#supporting-pkce-with-oauth-20
   */
  oauth2PkceMethod?: OAuth2PkceMethod;
  inputs: {
    /**
     * The OAuth 2.0 authorization URL where users can consent to granting you permissions
     * to their third-party account. (e.g. `https://app.acme.com/oauth2/authorize`)
     */
    authorizeUrl: ConnectionInput;
    /**
     * The OAuth 2.0 token URL which can be used to exchange an auth code or refresh
     * token for an access token. (e.g. `https://app.acme.com/oauth2/token`)
     */
    tokenUrl: ConnectionInput;
    /** OAuth 2.0 permissions (scopes) to request from the authenticated user. */
    scopes: ConnectionInput;
    /** OAuth 2.0 client ID (sometimes called app key or client key). */
    clientId: ConnectionInput;
    /** OAuth 2.0 client secret (sometimes called app secret or secret key). */
    clientSecret: ConnectionInput;
    [key: string]: ConnectionInput;
  };
}

interface OAuth2ClientCredentialConnectionDefinition extends BaseConnectionDefinition {
  oauth2Type: OAuth2Type.ClientCredentials;
  oauth2Config?: OAuth2UrlOverrides;
  inputs: {
    /**
     * The OAuth 2.0 token URL which can be used to exchange a client ID and secret
     * for an access token. (e.g. `https://app.acme.com/oauth2/token`)
     */
    tokenUrl: ConnectionInput;
    /** OAuth 2.0 permissions (scopes) to request from the authenticated user. */
    scopes: ConnectionInput;
    /** OAuth 2.0 client ID (sometimes called app key or client key). */
    clientId: ConnectionInput;
    /** OAuth 2.0 client secret (sometimes called app secret or secret key). */
    clientSecret: ConnectionInput;
    [key: string]: ConnectionInput;
  };
}

export type OAuth2ConnectionDefinition =
  | OAuth2AuthorizationCodeConnectionDefinition
  | OAuth2ClientCredentialConnectionDefinition;

export type ConnectionDefinition =
  | DefaultConnectionDefinition
  | OnPremConnectionDefinition
  | OAuth2ConnectionDefinition;
