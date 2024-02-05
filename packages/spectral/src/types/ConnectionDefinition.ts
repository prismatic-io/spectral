import { ConnectionInput } from ".";

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

interface OnPremiseConnectionInfo {
  host: string;
  port: string;
}

type ConnectionValues<T extends Record<string, ConnectionInput>> = {
  [Key in keyof T]: T[Key]["default"];
};

interface OnPremiseConfig<T extends Record<string, ConnectionInput>> {
  replacesInputs: (keyof T)[];
  transform: (
    opa: OnPremiseConnectionInfo,
    inConfig: ConnectionValues<T>
  ) => ConnectionValues<T>;
}

export interface DefaultConnectionDefinition extends BaseConnectionDefinition {
  onPremiseConfig?: OnPremiseConfig<this["inputs"]>;
  inputs: {
    [key: string]: ConnectionInput;
  };
}

interface OAuth2AuthorizationCodeConnectionDefinition
  extends BaseConnectionDefinition {
  oauth2Type: OAuth2Type.AuthorizationCode;
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
