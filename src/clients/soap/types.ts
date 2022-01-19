/* eslint-disable @typescript-eslint/no-explicit-any*/
import { Connection } from "../../index";
import { IMTOMAttachments } from "soap";

/**
 * SOAPConnection takes standard connection fields, and adds an optional `wsdlDefinitionUrl` field.
 */
export interface SOAPConnection extends Connection {
  fields: {
    [key: string]: unknown;
    // The URL where a WSDL can be found
    wsdlDefinitionUrl?: string;
  };
}

/**
 * This function determines if the object presented is a SOAP connection with a `wsdlDefinitionUrl` field.
 * @param connection The connection to test
 * @returns This function returns true if the connection is a SOAPConnection, and false otherwise.
 */
export const isSOAPConnection = (
  connection: unknown
): connection is SOAPConnection => {
  if (typeof connection === "object" && connection !== null)
    return "wsdlDefinitionURL" in (connection as Connection)?.fields;
  return false;
};

/**
 * SOAP requests return a 4-tuple or 5-tuple with the response first, the XML response second, headers third, and the XML request fourth, and optional message attachments fifth.
 */
export declare type SOAPResponse = [any, any, any, any, IMTOMAttachments?];

/**
 * Overload the `soapRequest` function to take a variety of types of arguments.
 */
export interface SOAPRequest {
  (params: RequestParams): Promise<SOAPResponse>;
  (
    params: RequestParams,
    methodParams: Record<string, unknown>
  ): Promise<SOAPResponse>;
  (params: RequestParams, methodParams: undefined): Promise<SOAPResponse>;
}

export interface RequestParams {
  // Either a SOAPConnection or WSDL definition
  wsdlParam: SOAPConnection | string;
  // The SOAP method to invoke
  method: string;
  // You can override the SOAP client `endpointURL` or `soapHeaders`
  overrides?: ClientOverrides;
  // Log debug information about the SOAP request
  debug?: boolean;
}

export interface ClientOverrides {
  // Override endpoint URL
  endpointURL?: string;
  // An array of [SOAP Headers](https://www.w3.org/TR/2000/NOTE-SOAP-20000508/#_Toc478383497)
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
    // A SOAP login method, defined in the WSDL
    loginMethod: unknown;
  };
}

/**
 * This function determines if the object presented is a Basic Auth connection with `username`, `password`, and `loginMethod` fields.
 * @param connection The connection to test
 * @returns This function returns true if the connection is a SOAPConnection, and false otherwise.
 */
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
