import { ConnectionInput } from ".";

export enum OAuth2Type {
  ClientCredentials = "client_credentials",
  AuthorizationCode = "authorization_code",
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

interface OAuth2AuthorizationCodeConnectionDefinition
  extends BaseConnectionDefinition {
  oauth2Type: OAuth2Type.AuthorizationCode;
  inputs: {
    authorizeUrl: ConnectionInput;
    tokenUrl: ConnectionInput;
    scopes: ConnectionInput;
    clientId: ConnectionInput;
    clientSecret: ConnectionInput;
    [key: string]: ConnectionInput;
  };
}

interface OAuth2ClientCredentialConnectionDefinition
  extends BaseConnectionDefinition {
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
  | OAuth2AuthorizationCodeConnectionDefinition
  | OAuth2ClientCredentialConnectionDefinition;
