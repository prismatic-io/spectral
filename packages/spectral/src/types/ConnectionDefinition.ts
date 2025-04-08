import type {
  ConnectionDisplayDefinition,
  ConnectionInput,
  ConnectionTemplateInputField,
  OnPremConnectionInput,
} from ".";
import merge from "lodash/merge";
import { templateConnection } from "..";

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
  display: ConnectionDisplayDefinition;
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

type TTemplateComplement<TRequired, TGiven> = {
  [K in Exclude<keyof TRequired, keyof TGiven>]: ConnectionTemplateInputField;
};

interface OAuth2AuthorizationCodeInputs {
  authorizeUrl: ConnectionInput;
  tokenUrl: ConnectionInput;
  scopes: ConnectionInput;
  clientId: ConnectionInput;
  clientSecret: ConnectionInput;
}

interface OAuth2ClientCredentialInputs {
  tokenUrl: ConnectionInput;
  scopes: ConnectionInput;
  clientId: ConnectionInput;
  clientSecret: ConnectionInput;
}

export interface TemplateBaseConnectionDefinition extends BaseConnectionDefinition {
  inputs: {
    [key: string]: ConnectionInput;
  };
}

export function templateInputs<
  TConnectionType extends "client_credentials" | "authorization_code" | null = null,
  TInputs extends Record<string, ConnectionInput> = Record<string, ConnectionInput>,
>(inputSet: {
  authType?: TConnectionType;
  inputs: TConnectionType extends null | undefined
    ? Record<string, ConnectionInput>
    : TConnectionType extends OAuth2Type.ClientCredentials
      ? TInputs & Partial<OAuth2ClientCredentialInputs> & { [key: string]: ConnectionInput }
      : TInputs & Partial<OAuth2AuthorizationCodeInputs> & { [key: string]: ConnectionInput };
  templateInputs: TConnectionType extends null | undefined
    ? { [key: string]: ConnectionTemplateInputField }
    : TConnectionType extends "client_credentials"
      ? TTemplateComplement<OAuth2ClientCredentialInputs, TInputs> & {
          [key: string]: ConnectionTemplateInputField;
        }
      : TTemplateComplement<OAuth2AuthorizationCodeInputs, TInputs> & {
          [key: string]: ConnectionTemplateInputField;
        };
}) {
  return merge(inputSet.inputs, inputSet.templateInputs);
}

export interface TemplateOAuth2AuthorizationCodeConnectionDefinition
  extends TemplateBaseConnectionDefinition {
  oauth2Type: OAuth2Type.AuthorizationCode;
  oauth2Config?: OAuth2Config & OAuth2UrlOverrides;
  /** The PKCE method (S256 or plain) that this OAuth 2.0 connection uses (if any) */
  oauth2PkceMethod?: OAuth2PkceMethod;
  templates: ReturnType<typeof templateInputs>;
}

export interface TemplateOAuth2ClientCredentialsConnectionDefinition
  extends TemplateBaseConnectionDefinition {
  oauth2Type: OAuth2Type.ClientCredentials;
  oauth2Config?: OAuth2UrlOverrides;
  templates: ReturnType<typeof templateInputs>;
}

export type TemplateConnectionDefinition =
  | TemplateBaseConnectionDefinition
  | TemplateOAuth2AuthorizationCodeConnectionDefinition
  | TemplateOAuth2ClientCredentialsConnectionDefinition;

interface OAuth2Config {
  overrideGrantType?: string;
  allowedTokenParams?: string[];
}

export interface OAuth2UrlOverrides {
  oAuthSuccessRedirectUri?: string;
  oAuthFailureRedirectUri?: string;
}

interface OAuth2AuthorizationCodeConnectionDefinition extends BaseConnectionDefinition {
  oauth2Type: OAuth2Type.AuthorizationCode;
  oauth2Config?: OAuth2Config & OAuth2UrlOverrides;
  /** The PKCE method (S256 or plain) that this OAuth 2.0 connection uses (if any) */
  oauth2PkceMethod?: OAuth2PkceMethod;
  inputs: OAuth2AuthorizationCodeInputs & {
    [key: string]: ConnectionInput;
  };
}

interface OAuth2ClientCredentialConnectionDefinition extends BaseConnectionDefinition {
  oauth2Type: OAuth2Type.ClientCredentials;
  oauth2Config?: OAuth2UrlOverrides;
  inputs: OAuth2ClientCredentialInputs & {
    [key: string]: ConnectionInput;
  };
}

export type OAuth2ConnectionDefinition =
  | OAuth2AuthorizationCodeConnectionDefinition
  | OAuth2ClientCredentialConnectionDefinition;

export type ConnectionDefinition =
  | DefaultConnectionDefinition
  | OnPremConnectionDefinition
  | OAuth2ConnectionDefinition
  | TemplateConnectionDefinition;

export const isTemplateConnectionDefinition = (
  def: ConnectionDefinition,
): def is TemplateConnectionDefinition =>
  "type" in def && def.type === "template" && "inputs" in def;
