import { ConnectionInputs, OAuth2Type } from ".";

export interface ConnectionDefinition {
  key: string;
  label: string;
  comments?: string;
  oauth2Type?: OAuth2Type;
  iconPath?: string;
  inputs: ConnectionInputs;
}
