/* eslint-disable @typescript-eslint/no-explicit-any*/
import { Connection } from "../../index";
import { Client, IMTOMAttachments } from "soap";
export interface SOAPConnection extends Connection {
  fields: {
    [key: string]: unknown;
    wsdlDefinitionUrl?: string;
  };
}

export const isSOAPConnection = (
  connection: unknown
): connection is SOAPConnection => {
  if (typeof connection === "object" && connection !== null)
    return "wsdlDefinitionURL" in (connection as Connection)?.fields;
  return false;
};

export interface GetClient {
  (connection: SOAPConnection): Promise<Client>;
  (wsdlDefinition: string): Promise<Client>;
}
export interface SOAPRequest {
  (params: RequestParams): Promise<[any, any, any, any, IMTOMAttachments?]>;
  (params: RequestParams, methodParams: Record<string, unknown>): Promise<
    [any, any, any, any, IMTOMAttachments?]
  >;
  (params: RequestParams, methodParams: undefined): Promise<
    [any, any, any, any, IMTOMAttachments?]
  >;
}
export interface RequestParams {
  wsdlParam: SOAPConnection | string;
  method: string;
  overrides?: ClientOverrides;
  debug?: boolean;
}
export interface ClientOverrides {
  endpointURL?: string;
  soapHeaders?: unknown[];
}
export interface HeaderPayload {
  [x: string]: any;
}
export interface GenerateHeader {
  (
    wsdlParam: SOAPConnection | string,
    headerPayload: HeaderPayload,
    headerOptions: undefined
  ): Promise<string>;
  (
    wsdlParam: SOAPConnection | string,
    headerPayload: HeaderPayload,
    headerOptions: { namespace: string; xmlns: string }
  ): Promise<string>;
}
export interface BasicAuthConnection extends Connection {
  fields: {
    [key: string]: unknown;
    username: unknown;
    password: unknown;
    loginMethod: unknown;
  };
}

export const isBasicAuthConnection = (
  connection: Connection
): connection is BasicAuthConnection => {
  const { fields } = connection;
  return (
    "username" in fields && "password" in fields && "loginMethod" in fields
  );
};
export interface SOAPAuth {
  (connection: BasicAuthConnection, wsdlDefinition: string): Promise<any>;
  (connection: BasicAuthConnection & SOAPConnection): Promise<any>;
}

export interface DescribeWSDL {
  (connection: SOAPConnection): Promise<any>;
  (wsdlDefinition: string): Promise<any>;
}
