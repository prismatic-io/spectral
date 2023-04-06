import { isEmpty } from "lodash";
import axios, { AxiosResponse } from "axios";
import { AxiosInstance, AxiosRequestConfig } from "axios";
import axiosRetry, { IAxiosRetryConfig, exponentialDelay } from "axios-retry";
import FormData from "form-data";
import { action } from "../..";
import { ActionInputParameters, Connection, KeyValuePair } from "../../types";
import util from "../../util";
import { inputs } from "./inputs";

export type HttpClient = AxiosInstance;

const toAuthorizationHeaders = (
  connection: Connection
): { Authorization: string } => {
  const accessToken = util.types.toString(connection.token?.access_token);
  if (accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  const apiKey = util.types.toString(connection.fields?.apiKey);
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
  }

  const username = util.types.toString(connection.fields?.username);
  const password = util.types.toString(connection.fields?.password);
  if (username && password) {
    const encoded = Buffer.from(`${username}:${password}`).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }

  throw new Error(
    `Failed to guess at authorization parameters for Connection: ${connection.key}`
  );
};

const toFormData = (
  formData: KeyValuePair<unknown>[],
  fileData: KeyValuePair<unknown>[]
): FormData => {
  const form = new FormData();
  (formData || []).map(({ key, value }) => form.append(key, value));
  (fileData || []).map(({ key, value }) =>
    form.append(key, util.types.toBufferDataPayload(value).data, {
      filename: key,
    })
  );
  return form;
};

interface RetryConfig extends Omit<IAxiosRetryConfig, "retryDelay"> {
  retryDelay?: IAxiosRetryConfig["retryDelay"] | number;
  retryAllErrors?: boolean;
  useExponentialBackoff?: boolean;
}

export interface ClientProps {
  baseUrl?: string;
  responseType?: AxiosRequestConfig["responseType"];
  headers?: AxiosRequestConfig["headers"];
  params?: Record<string, any>;
  timeout?: number;
  debug?: boolean;
  retryConfig?: RetryConfig;
}

const computeRetryDelay = (
  retryDelay: RetryConfig["retryDelay"],
  useExponentialBackoff: RetryConfig["useExponentialBackoff"]
): IAxiosRetryConfig["retryDelay"] => {
  if (useExponentialBackoff) {
    return exponentialDelay;
  }
  return typeof retryDelay === "number" ? () => retryDelay : retryDelay;
};

const toAxiosRetryConfig = ({
  retryDelay,
  retryAllErrors,
  retryCondition,
  useExponentialBackoff,
  ...rest
}: RetryConfig): IAxiosRetryConfig => ({
  ...rest,
  retryDelay: computeRetryDelay(retryDelay, useExponentialBackoff),
  retryCondition: retryAllErrors ? () => true : retryCondition,
});

export const createClient = ({
  baseUrl,
  responseType,
  headers,
  timeout,
  params,
  debug = false,
  retryConfig,
}: ClientProps): HttpClient => {
  const client = axios.create({
    baseURL: baseUrl,
    responseType,
    headers,
    timeout,
    params,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  if (debug) {
    client.interceptors.request.use((request) => {
      console.log(util.types.toJSON(request));
      return request;
    });
    client.interceptors.response.use((response) => {
      console.log(util.types.toJSON(response));
      return response;
    });
  }

  if (retryConfig) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axiosRetry(client as any, toAxiosRetryConfig(retryConfig));
  }

  return client;
};

export const handleErrors = (error: unknown): unknown => {
  if (axios.isAxiosError(error)) {
    const { message, response } = error;
    return {
      message,
      data: response?.data,
    };
  }
  return error;
};

type SendRawRequestValues = ActionInputParameters<typeof inputs>;

export const sendRawRequest = async (
  baseUrl: string,
  values: SendRawRequestValues,
  authorizationHeaders: Record<string, string> = {}
): Promise<AxiosResponse> => {
  if (values.data && (!isEmpty(values.formData) || !isEmpty(values.fileData))) {
    throw new Error("Cannot specify both Data and File/Form Data.");
  }

  const payload =
    !isEmpty(values.formData) || !isEmpty(values.fileData)
      ? toFormData(values.formData, values.fileData)
      : values.data;

  const client = createClient({
    baseUrl,
    debug: values.debugRequest,
    responseType: values.responseType,
    timeout: values.timeout,
    retryConfig: {
      retries: values.maxRetries,
      retryDelay: values.retryDelayMS,
      retryAllErrors: values.retryAllErrors,
      useExponentialBackoff: values.useExponentialBackoff,
    },
  });

  return await client.request({
    method: values.method,
    url: values.url,
    headers: {
      ...util.types.keyValPairListToObject(values.headers),
      ...(payload instanceof FormData ? payload.getHeaders() : {}),
      ...authorizationHeaders,
    },
    params: util.types.keyValPairListToObject(values.queryParams),
    data: payload || undefined,
  });
};

export const buildRawRequestAction = (
  baseUrl: string,
  label = "Raw Request",
  description = "Issue a raw HTTP request"
) =>
  action({
    display: { label, description },
    inputs: {
      connection: { label: "Connection", type: "connection", required: true },
      ...inputs,
    },
    perform: async (context, { connection, ...httpInputValues }) => {
      const { data } = await sendRawRequest(
        baseUrl,
        httpInputValues,
        toAuthorizationHeaders(connection)
      );
      return { data };
    },
  });

export { inputs };
