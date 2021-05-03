import { OAuth2AuthorizationMethod } from ".";

export type Credential =
  | BasicCredential
  | ApiKeyCredential
  | ApiKeySecretCredential
  | PrivateKeyCredential
  | OAuth2Credential;

export interface BasicCredential {
  authorizationMethod: "basic";
  fields: {
    username: string;
    password: string;
  };
}

export interface ApiKeyCredential {
  authorizationMethod: "api_key";
  fields: {
    api_key: string;
  };
}

export interface ApiKeySecretCredential {
  authorizationMethod: "api_key_secret";
  fields: {
    api_key: string;
    api_secret: string;
  };
}

export interface PrivateKeyCredential {
  authorizationMethod: "private_key";
  fields: {
    username: string;
    private_key: string;
  };
}
export interface OAuth2Credential {
  authorizationMethod: OAuth2AuthorizationMethod;
  redirectUri: string;
  fields: {
    client_id: string;
    client_secret: string;
    token_uri: string;
    auth_uri?: string;
    scopes?: string;
  };
  token: {
    access_token: string;
    token_type: string;
    refresh_token?: string;
    expires_in?: string;
    [key: string]: string | undefined;
  };
  context: { [key: string]: string };
}
