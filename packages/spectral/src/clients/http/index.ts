import axios from "axios";
import { AxiosInstance, AxiosRequestConfig } from "axios";
import axiosRetry, { IAxiosRetryConfig } from "axios-retry";
import { toJSON } from "../../util";

export type HttpClient = AxiosInstance;

export interface ClientProps {
  baseUrl?: string;
  responseType?: AxiosRequestConfig["responseType"];
  headers?: AxiosRequestConfig["headers"];
  timeout?: number;
  debug?: boolean;
  retryConfig?: IAxiosRetryConfig;
}

export const createClient = ({
  baseUrl,
  responseType,
  headers,
  timeout,
  debug = false,
  retryConfig,
}: ClientProps): HttpClient => {
  const client = axios.create({
    baseURL: baseUrl,
    responseType,
    headers,
    timeout,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  if (debug) {
    client.interceptors.request.use((request) => {
      console.log(toJSON(request));
      return request;
    });
    client.interceptors.response.use((response) => {
      console.log(toJSON(response));
      return response;
    });
  }

  if (retryConfig) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axiosRetry(client as any, retryConfig);
  }

  return client;
};

export const handleErrors = (error: unknown): unknown => {
  if (axios.isAxiosError(error)) {
    const { message, response } = error;
    return {
      message,
      data: response?.data as unknown,
    };
  }
  return error;
};
