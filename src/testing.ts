/**
 * This module provides functions to help developers unit
 * test custom components prior to publishing them. For
 * information on unit testing, check out our docs:
 * https://prismatic.io/docs/custom-components/writing-custom-components/#testing-a-component
 */

/** */
import {
  ActionContext,
  ActionLogger,
  ActionLoggerFunction,
  ActionDefinition,
  ActionInputParameters,
  Credential,
  BasicCredential,
  ApiKeyCredential,
  ApiKeySecretCredential,
  PrivateKeyCredential,
  OAuth2Credential,
  PerformReturn,
  AuthorizationMethod,
  AvailableAuthorizationMethods,
  Inputs,
} from "./types";
import { spyOn } from "jest-mock";

/**
 * Get an array of available authorization methods that a custom component can use.
 * @param except Return authorization methods _except for_ those in this array.
 * @returns This function returns an array of available authorization methods.
 */
export const getAuthorizationMethods = (
  except?: AuthorizationMethod[]
): AuthorizationMethod[] => {
  if (except === undefined) {
    return AvailableAuthorizationMethods;
  }
  return AvailableAuthorizationMethods.filter((m) => !except.includes(m));
};

/** Utility functions to generate the different types of Credentials for testing. */
export const credentials = {
  /** Return a BasicCredential assembled from provided username and password. */
  basic: (username: string, password: string): BasicCredential => ({
    authorizationMethod: "basic",
    fields: {
      username,
      password,
    },
  }),
  /** Return a ApiKeyCredential assembled from provided key. */
  apiKey: (key: string): ApiKeyCredential => ({
    authorizationMethod: "api_key",
    fields: { api_key: key },
  }),
  /** Return a ApiKeySecretCredential assembled from provided key and secret. */
  apiKeySecret: (key: string, secret: string): ApiKeySecretCredential => ({
    authorizationMethod: "api_key_secret",
    fields: {
      api_key: key,
      api_secret: secret,
    },
  }),
  /** Return a PrivateKeyCredential assembled from provided username and privateKey. */
  privateKey: (username: string, privateKey: string): PrivateKeyCredential => ({
    authorizationMethod: "private_key",
    fields: {
      username,
      private_key: privateKey,
    },
  }),
  /** Return a OAuth2Credential assembled from provided token and optional redirectUri. */
  oauth2: (
    token: string,
    redirectUri = "",
    tokenUri = "",
    clientId = "",
    clientSecret = "",
    headers = {}
  ): OAuth2Credential => ({
    authorizationMethod: "oauth2",
    redirectUri,
    fields: {
      client_id: clientId,
      client_secret: clientSecret,
      token_uri: tokenUri,
      headers,
    },
    token: { access_token: token, token_type: "bearer" },
    context: {},
  }),
  /** Return a OAuth2Credential assembled from provided token. */
  oauth2ClientCredentials: (
    token: string,
    redirectUri = "",
    tokenUri = "",
    clientId = "",
    clientSecret = "",
    headers = {}
  ): OAuth2Credential => ({
    authorizationMethod: "oauth2_client_credentials",
    redirectUri: redirectUri,
    fields: {
      client_id: clientId,
      client_secret: clientSecret,
      token_uri: tokenUri,
      headers,
    },
    token: { access_token: token, token_type: "bearer" },
    context: {},
  }),
  /** Returns an arbitrary Credential using method. Generally used for testing negative support cases. */
  generate: (method: AuthorizationMethod): Credential =>
    ({
      authorizationMethod: method,
      fields: {},
    } as Credential),
};

/**
 * Pre-built mock of ActionLogger. Suitable for asserting logs are created as expected.
 * See https://prismatic.io/docs/custom-components/writing-custom-components/#verifying-correct-logging-in-action-tests for information on testing correct logging behavior in your custom component.
 */
export const loggerMock = (): ActionLogger => ({
  debug: spyOn(console, "debug") as unknown as ActionLoggerFunction,
  info: spyOn(console, "info") as unknown as ActionLoggerFunction,
  log: spyOn(console, "log") as unknown as ActionLoggerFunction,
  warn: spyOn(console, "warn") as unknown as ActionLoggerFunction,
  error: spyOn(console, "error") as unknown as ActionLoggerFunction,
});

/**
 * The type of data returned by an `invoke()` function used for unit testing component actions.
 */
interface InvokeReturn<ReturnData> {
  result: ReturnData;
  loggerMock: ActionLogger;
}

/**
 * Invokes specified ActionDefinition perform function using supplied params
 * and optional context. Accepts a generic type matching PerformReturn as a convenience
 * to avoid extra casting within test methods. Returns an InvokeResult containing both the
 * action result and a mock logger for asserting logging.
 */
export const invoke = async <
  T extends Inputs,
  AllowsBranching extends boolean,
  ReturnData extends PerformReturn<AllowsBranching, unknown>
>(
  actionBase:
    | ActionDefinition<T, AllowsBranching, ReturnData>
    | Record<string, ActionDefinition<T, AllowsBranching, ReturnData>>,
  params: ActionInputParameters<T>,
  context?: Partial<ActionContext>
): Promise<InvokeReturn<ReturnData>> => {
  const action = (
    actionBase.perform ? actionBase : Object.values(actionBase)[0]
  ) as ActionDefinition<T, AllowsBranching, ReturnData>;

  const realizedContext = {
    credential: undefined,
    logger: loggerMock(),
    instanceState: {},
    stepId: "mockStepId",
    ...context,
  };

  const result = await action.perform(realizedContext, params);

  return {
    result,
    loggerMock: realizedContext.logger,
  };
};

export default {
  invoke,
  loggerMock,
  getAuthorizationMethods,
  credentials,
};
