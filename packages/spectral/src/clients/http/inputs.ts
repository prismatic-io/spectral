import { input } from "../..";
import { Method, ResponseType } from "axios";

const supportedMethods: Method[] = [
  "DELETE",
  "GET",
  "HEAD",
  "LINK",
  "OPTIONS",
  "PATCH",
  "POST",
  "PURGE",
  "PUT",
  "UNLINK",
];

const supportedResponseTypes: ResponseType[] = [
  "arraybuffer",
  "document",
  "json",
  "text",
];

export const url = input({
  label: "URL",
  placeholder: "URL to call",
  type: "string",
  required: true,
  comments: "This is the URL to call.",
  example: "/sobjects/Account",
});

export const data = input({
  label: "Data",
  placeholder: "Data to send",
  type: "string",
  required: false,
  comments:
    "The HTTP body payload to send to the URL. Must be a string or a reference to output from a previous step.",
  example: '{"exampleKey": "Example Data"}',
});

export const timeout = input({
  label: "Timeout",
  type: "string",
  required: false,
  comments:
    "The maximum time that a client will await a response to its request",
  example: "2000",
});

export const method = input({
  label: "Method",
  type: "string",
  model: supportedMethods.map((method) => ({ label: method, value: method })),
  comments: "The HTTP method to use.",
});

export const responseType = input({
  label: "Response Type",
  placeholder: "Response Type",
  type: "string",
  default: "json",
  required: false,
  comments:
    "The type of data you expect in the response. You can request json, text, or binary data.",
  model: supportedResponseTypes.map((responseType) => ({
    label: responseType,
    value: responseType,
  })),
});

export const headers = input({
  label: "Header",
  placeholder: "Header",
  type: "string",
  collection: "keyvaluelist",
  required: false,
  comments: "A list of headers to send with the request.",
  example: "User-Agent: curl/7.64.1",
});

export const queryParams = input({
  label: "Query Parameter",
  placeholder: "Query Parameter",
  type: "string",
  collection: "keyvaluelist",
  required: false,
  comments:
    "A list of query parameters to send with the request. This is the portion at the end of the URL similar to ?key1=value1&key2=value2.",
});

export const maxRetries = input({
  label: "Max Retry Count",
  placeholder: "Max Retries",
  type: "string",
  required: false,
  comments: "The maximum number of retries to attempt.",
  default: "0",
});

export const retryDelayMS = input({
  label: "Retry Delay (ms)",
  placeholder: "Retry Delay",
  type: "string",
  required: false,
  comments: "The delay in milliseconds between retries.",
  default: "0",
});

export const useExponentialBackoff = input({
  label: "Use Exponential Backoff",
  type: "boolean",
  default: "false",
  required: false,
  comments:
    "Specifies whether to use a pre-defined exponential backoff strategy for retries.",
});

export const retryOnAllErrors = input({
  label: "Retry On All Errors",
  type: "boolean",
  default: "false",
  required: false,
  comments: "If true, retries on all erroneous responses regardless of type.",
});

export const formData = input({
  label: "Form Data",
  placeholder: "Data to send",
  type: "string",
  collection: "keyvaluelist",
  required: false,
  comments: "The Form Data to be sent as a multipart form upload.",
  example: '[{"key": "Example Key", "value": new Buffer("Hello World")}]',
});

export const fileData = input({
  label: "File Data",
  placeholder: "Data to send",
  type: "string",
  collection: "keyvaluelist",
  required: false,
  comments: "File Data to be sent as a multipart form upload.",
  example: `[{key: "example.txt", value: "My File Contents"}]`,
});

export const debugRequest = input({
  label: "Debug Request",
  type: "boolean",
  required: false,
  comments: "Enabling this flag will log out the current request.",
});