import type { ConnectionInput, OnPremConnectionInput } from ".";

export enum OAuth2Type {
  ClientCredentials = "client_credentials",
  AuthorizationCode = "authorization_code",
}

export enum OAuth2PkceMethod {
  Plain = "plain",
  S256 = "S256",
}

interface BaseConnectionDefinition {
  key: string;
  label: string;
  comments?: string;
  iconPath?: string;
  oauth2Type?: OAuth2Type;
}

export interface DefaultConnectionDefinition extends BaseConnectionDefinition {
  inputs: {
    [key: string]: ConnectionInput;
  };
}

export interface OnPremConnectionDefinition extends BaseConnectionDefinition {
  inputs: {
    host: OnPremConnectionInput;
    port: OnPremConnectionInput;
    [key: string]: ConnectionInput;
  };
}

interface OAuth2Config {
  overrideGrantType?: string;
  allowedTokenParams?: string[];
}

interface OAuth2AuthorizationCodeConnectionDefinition extends BaseConnectionDefinition {
  oauth2Type: OAuth2Type.AuthorizationCode;
  oauth2Config?: OAuth2Config;
  /** The PKCE method (S256 or plain) that this OAuth 2.0 connection uses (if any) */
  oauth2PkceMethod?: OAuth2PkceMethod;
  inputs: {
    authorizeUrl: ConnectionInput;
    tokenUrl: ConnectionInput;
    scopes: ConnectionInput;
    clientId: ConnectionInput;
    clientSecret: ConnectionInput;
    [key: string]: ConnectionInput;
  };
}

interface OAuth2ClientCredentialConnectionDefinition extends BaseConnectionDefinition {
  oauth2Type: OAuth2Type.ClientCredentials;
  inputs: {
    tokenUrl: ConnectionInput;
    scopes: ConnectionInput;
    clientId: ConnectionInput;
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
