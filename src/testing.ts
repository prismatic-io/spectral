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
  ActionPerformFunction,
} from "./types";
import { spyOn } from "jest-mock";

/** Return listing of available authorization methods. If except is provided
 * the returned list will be any authorization methods not in that list.
 */
export const getAuthorizationMethods = (
  except?: AuthorizationMethod[]
): AuthorizationMethod[] => {
  if (except === undefined) {
    return AvailableAuthorizationMethods;
  }
  return AvailableAuthorizationMethods.filter((m) => !except.includes(m));
};

/* eslint-disable @typescript-eslint/camelcase */
/** Utility functions to generate the different types of Credentials. */
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
  oauth2: (token: string, redirectUri = ""): OAuth2Credential => ({
    authorizationMethod: "oauth2",
    redirectUri,
    fields: {} as any,
    token: { access_token: token, token_type: "bearer" },
    context: {} as any,
  }),
  /** Return a OAuth2Credential assembled from provided token. */
  oauth2ClientCredentials: (token: string): OAuth2Credential => ({
    authorizationMethod: "oauth2_client_credentials",
    redirectUri: "",
    fields: {} as any,
    token: { access_token: token, token_type: "bearer" },
    context: {} as any,
  }),
  /** Returns an arbitrary Credential using method. Generally used for testing negative support cases. */
  generate: (method: AuthorizationMethod): Credential =>
    (({
      authorizationMethod: method,
      fields: {},
    } as unknown) as Credential),
};
/* eslint-enable @typescript-eslint/camelcase */

/** Pre-built mock of ActionLogger. Suitable for asserting logs are created as expected. */
export const loggerMock = (): ActionLogger => ({
  debug: (spyOn(console, "debug") as unknown) as ActionLoggerFunction,
  info: (spyOn(console, "info") as unknown) as ActionLoggerFunction,
  log: (spyOn(console, "log") as unknown) as ActionLoggerFunction,
  warn: (spyOn(console, "warn") as unknown) as ActionLoggerFunction,
  error: (spyOn(console, "error") as unknown) as ActionLoggerFunction,
});

export interface InvokeResult<TReturn extends PerformReturn> {
  result: TReturn;
  loggerMock: ActionLogger;
}

/** Invokes specified ActionDefinition perform function using supplied params
 * and optional context. Accepts a generic type matching PerformReturn as a convenience
 * to avoid extra casting within test methods. Returns an InvokeResult containing both the
 * action result and a mock logger for asserting logging.
 */
export const invoke = async <TReturn extends PerformReturn>(
  action: ActionDefinition | Record<string, ActionDefinition>,
  params: ActionInputParameters,
  context?: Partial<ActionContext>
): Promise<InvokeResult<TReturn>> => {
  const perform = (action.perform ||
    Object.values(action)[0].perform) as ActionPerformFunction;
  const realizedContext = {
    credential: undefined,
    logger: loggerMock(),
    instanceState: {},
    stepId: "mockStepId",
    ...context,
  };
  const result = (await perform(realizedContext, params)) as TReturn;
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
