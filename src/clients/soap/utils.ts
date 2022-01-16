/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ClientOverrides,
  HeaderPayload,
  GenerateHeader,
  GetClient,
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

const debugRequest = (client: Client) => {
  console.debug(client.lastRequest);
  console.debug(client.lastResponse);
};
export const describeWSDL: DescribeWSDL = async (
  wsdlParam: unknown
): Promise<string> => {
  let client: Client;
  if (isSOAPConnection(wsdlParam)) {
    client = await getSOAPClient(wsdlParam);
  } else {
    client = await getSOAPClient(util.types.toString(wsdlParam));
  }
  try {
    const result = client.describe();
    return result;
  } catch (error) {
    throw new Error("Unable to parse WSDL Services due to circular references");
  }
};
const getWSDL = async (wsdlDefinitionURL: string): Promise<string> => {
  const httpClient = axios.create({
    baseURL: wsdlDefinitionURL,
    headers: { "Content-Type": "text/xml" },
  });
  const { data } = await httpClient.get("");
  return util.types.toString(data);
};

const getSOAPClient: GetClient = async (wsdlParam: unknown) => {
  if (typeof wsdlParam === "string") {
    const wsdl = util.types.toString(wsdlParam);
    const filePath = `/tmp/${uuid()}.wsdl`;
    await writeFile(filePath, wsdl);
    const client = await createClientAsync(filePath);
    await rm(filePath);
    return client;
  } else if (isSOAPConnection(wsdlParam as SOAPConnection)) {
    const {
      fields: { wsdlDefinitionURL },
    } = wsdlParam as SOAPConnection;
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

const soapRequest: SOAPRequest = async (
  { wsdlParam, method, overrides, debug }: RequestParams,
  methodParams?: unknown
) => {
  let client: Client;
  if (isSOAPConnection(wsdlParam)) {
    client = await getSOAPClient(wsdlParam);
  } else {
    client = await getSOAPClient(wsdlParam);
  }
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
    throw error;
  }
};

const generateHeader: GenerateHeader = async (
  wsdlParam,
  headerPayload: HeaderPayload,
  headerOptions
) => {
  let client: Client;
  if (isSOAPConnection(wsdlParam)) {
    client = await getSOAPClient(wsdlParam);
  } else {
    client = await getSOAPClient(wsdlParam);
  }

  let options: string[] = [];
  if (headerOptions) {
    options = Object.values(headerOptions);
  }
  const index = client.addSoapHeader(headerPayload, "", ...options);
  return client.getSoapHeaders()[index];
};

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
  generateHeader,
  getSOAPClient,
  getSOAPAuth,
  getWSDL,
  overrideClientDefaults,
  soapRequest,
  describeWSDL,
};
