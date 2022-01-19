/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ClientOverrides,
  HeaderPayload,
  GenerateHeader,
  RequestParams,
  SOAPAuth,
  SOAPConnection,
  SOAPRequest,
  isBasicAuthConnection,
  isSOAPConnection,
  DescribeWSDL,
} from "./types";
import { Connection, util } from "../../index";
import { createClientAsync, Client, SoapMethodAsync } from "soap";
import axios from "axios";
import { writeFile, rm } from "fs/promises";
import { v4 as uuid } from "uuid";
import os from "os";
import path from "path";

/**
 *
 * @param client
 */
const debugRequest = (client: Client) => {
  console.debug(client.lastRequest);
  console.debug(client.lastResponse);
};

/**
 * This function takes either the URL of a WSDL or the XML defining a WSDL, and returns an object describing the methods and attributes defined in the WSDL.
 *
 * @param wsdlParam Either the URL where a WSDL is stored, or the XML defining a WSDL.
 * @returns An object containing the methods and attributes defined in a WSDL
 */
const describeWSDL: DescribeWSDL = async (
  wsdlParam: unknown
): Promise<string> => {
  const client = await getSOAPClient(
    isSOAPConnection(wsdlParam) ? wsdlParam : util.types.toString(wsdlParam)
  );

  try {
    const result = client.describe();
    return result;
  } catch (error) {
    throw new Error("Unable to parse WSDL Services due to circular references");
  }
};

/**
 * Fetch a WSDL from a URL
 * @param wsdlDefinitionURL The URL where the WSDL is stored
 * @returns The WSDL's raw XML
 */
const getWSDL = async (wsdlDefinitionURL: string): Promise<string> => {
  const httpClient = axios.create({
    baseURL: wsdlDefinitionURL,
    headers: { "Content-Type": "text/xml" },
  });
  const { data } = await httpClient.get("");
  return util.types.toString(data);
};

/**
 * Create a SOAP client given a WSDL or SOAPConnection
 * @param wsdlParam a SOAPConnection or XML defining a WSDL
 * @returns An HTTP client configured to query a SOAP-based API
 */
const getSOAPClient = async <
  T extends string | SOAPConnection = string | SOAPConnection
>(
  wsdlParam: T
): Promise<Client> => {
  if (typeof wsdlParam === "string") {
    const wsdl = util.types.toString(wsdlParam);
    const filePath = path.join(os.tmpdir(), `${uuid()}.wsdl`);
    await writeFile(filePath, wsdl);
    const client = await createClientAsync(filePath);
    await rm(filePath);
    return client;
  } else if (isSOAPConnection(wsdlParam)) {
    const {
      fields: { wsdlDefinitionURL },
    } = wsdlParam;
    if (
      !wsdlDefinitionURL ||
      !util.types.isUrl(util.types.toString(wsdlDefinitionURL))
    ) {
      throw new Error(
        "WSDL Definition or the Connection field 'wsdlDefinitionURL' must be supplied."
      );
    }
    const client = await createClientAsync(
      util.types.toString(wsdlDefinitionURL)
    );
    return client;
  } else {
    throw new Error(
      "WSDL Definition or the Connection field 'wsdlDefinitionURL' must be supplied."
    );
  }
};

/**
 * Override some HTTP client defaults
 * @param client The client to override
 * @param overrides An endpoint URL or SOAP headers to override
 */
const overrideClientDefaults = (
  client: Client,
  overrides: ClientOverrides
): void => {
  const { endpointURL, soapHeaders } = overrides;
  if (endpointURL) {
    client.setEndpoint(endpointURL);
  }
  if (soapHeaders) {
    soapHeaders.map((header) => {
      client.addSoapHeader(header);
    });
  }
};

/**
 * Make a request to a SOAP-based API
 * @param param0 An object containing how to connect to a SOAP-based API, the method to onvoke, any overridden values for the HTTP client, and whether or not to log debug messages
 * @param methodParams Parameters to pass to the specified SOAP method
 * @returns The results from the SOAP request, including the full XML of the request and response
 */
const soapRequest: SOAPRequest = async (
  { wsdlParam, method, overrides, debug }: RequestParams,
  methodParams?: unknown
) => {
  const client = await getSOAPClient(
    isSOAPConnection(wsdlParam) ? wsdlParam : util.types.toString(wsdlParam)
  );
  if (overrides) {
    overrideClientDefaults(client, overrides);
  }
  const requestFunction: SoapMethodAsync = client[`${method}Async`];
  let results = undefined;

  try {
    if (typeof methodParams === "object" && methodParams !== null) {
      results = await requestFunction(methodParams);
    } else {
      results = await requestFunction({});
    }
    if (util.types.isBool(debug) && debug) {
      debugRequest(client);
    }
    return results;
  } catch (error) {
    if (util.types.isBool(debug) && debug) {
      debugRequest(client);
    }
    console.warn(
      "Please verify that the method you specified exists in the WSDL specification."
    );
    throw error;
  }
};

/**
 * Create a SOAP header
 * @param wsdlParam A SOAPConnection or XML definition of a WSDL
 * @param headerPayload The contents of a header XML node
 * @param headerOptions Attributes for a header XML node, like namespace or xmlns
 * @returns
 */
const generateHeader: GenerateHeader = async (
  wsdlParam,
  headerPayload: HeaderPayload,
  headerOptions
) => {
  const client = await getSOAPClient(
    isSOAPConnection(wsdlParam) ? wsdlParam : util.types.toString(wsdlParam)
  );

  let options: string[] = [];
  if (headerOptions) {
    options = Object.values(headerOptions);
  }
  const index = client.addSoapHeader(headerPayload, "", ...options);
  return client.getSoapHeaders()[index];
};

/**
 * Fetch authentication information for a SOAPConnection
 * @param connection The SOAPConnection
 * @param wsdlDefinition The XML WSDL definition
 * @returns
 */
const getSOAPAuth: SOAPAuth = async (
  connection: Connection,
  wsdlDefinition?: string
) => {
  if (isBasicAuthConnection(connection) && wsdlDefinition) {
    const {
      fields: { username, password, loginMethod },
    } = connection;
    const result = await soapRequest(
      {
        wsdlParam: util.types.toString(wsdlDefinition),
        method: util.types.toString(loginMethod),
      },
      { username, password }
    );
    return result;
  } else if (
    isSOAPConnection(connection) &&
    isBasicAuthConnection(connection)
  ) {
    const {
      fields: { username, password, loginMethod },
    } = connection;
    const result = await soapRequest(
      {
        wsdlParam: connection as SOAPConnection,
        method: util.types.toString(loginMethod),
      },
      { username, password }
    );
    return result;
  } else {
    throw new Error("Must supply a SOAP Connection or a WSDL Definition");
  }
};

export default {
  describeWSDL,
  generateHeader,
  getSOAPAuth,
  getSOAPClient,
  getWSDL,
  overrideClientDefaults,
  soapRequest,
};
