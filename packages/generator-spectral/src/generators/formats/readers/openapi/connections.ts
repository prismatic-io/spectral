import { OpenAPIV3 } from "openapi-types";
import { camelCase, startCase } from "lodash";
import {
  Connection,
  ConnectionInput,
  createDescription,
  stripUndefined,
} from "../../utils";
import { OAuth2Type } from "@prismatic-io/spectral";

export const buildConnections = (
  key: string,
  scheme: OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject
): Connection[] => {
  if ("$ref" in scheme) {
    throw new Error("$ref nodes are not supported.");
  }

  if (
    scheme.type === "apiKey" ||
    (scheme.type === "http" && scheme.scheme === "bearer")
  ) {
    const connection = stripUndefined<Connection>({
      orderPriority: 50,
      key: camelCase(key),
      label: startCase(key),
      comments: createDescription(scheme.description),
      inputs: {
        apiKey: {
          label: startCase(scheme.type === "apiKey" ? scheme.name : "Token"),
          type: "password",
          required: true,
        },
      },
    });
    return [connection];
  }

  if (scheme.type === "http" && scheme.scheme === "basic") {
    const connection = stripUndefined<Connection>({
      orderPriority: 1000,
      key: camelCase(key),
      label: startCase(key),
      comments: createDescription(scheme.description),
      inputs: {
        username: {
          label: "Username",
          type: "string",
          required: true,
        },
        password: {
          label: "Password",
          type: "password",
          required: true,
        },
      },
    });
    return [connection];
  }

  if (scheme.type === "oauth2") {
    if ("authorizationCode" in scheme.flows) {
      const authCodeFlow = scheme.flows.authorizationCode;
      const usesScopes =
        authCodeFlow?.scopes && Object.keys(authCodeFlow.scopes).length > 0;
      const connection = stripUndefined<Connection>({
        orderPriority: 0,
        key: camelCase(key),
        label: "OAuth 2.0", // TODO: Apparently OpenAPI lacks a name/description for this scheme? Ok.
        oauth2Type: OAuth2Type.AuthorizationCode,
        inputs: {
          authorizeUrl: stripUndefined<ConnectionInput>({
            label: "Authorization URL",
            type: "string",
            required: true,
            shown: !authCodeFlow?.authorizationUrl,
            default: authCodeFlow?.authorizationUrl,
            comments: "Authorization URL",
          }),
          tokenUrl: stripUndefined<ConnectionInput>({
            label: "Token URL",
            type: "string",
            required: true,
            shown: !authCodeFlow?.tokenUrl,
            default: authCodeFlow?.tokenUrl,
            comments: "Token URL",
          }),
          scopes: stripUndefined<ConnectionInput>({
            label: "Scopes",
            type: "string",
            required: true,
            shown: usesScopes,
            default: usesScopes ? undefined : "",
            comments: "Space-delimited scopes",
          }),
          clientId: {
            label: "Client ID",
            type: "string",
            required: true,
            shown: true,
            comments: "Client identifier",
          },
          clientSecret: {
            label: "Client Secret",
            type: "password",
            required: true,
            shown: true,
            comments: "Client secret",
          },
        },
      });
      return [connection];
    }

    throw new Error("Did not find supported OAuth 2.0 flow.");
  }

  throw new Error(`Security scheme '${scheme.type}' not supported.`);
};
