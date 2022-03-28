import {
	connection,
  oauth2Connection,
  OAuth2Type,
} from "@prismatic-io/spectral";

export const <%= connection.key %> = oauth2Connection({
  key: "<%= connection.key %>",
  label: "<%= connection.label %>",
  comments: "<%= connection.comments %>",
  oauth2Type: OAuth2Type.AuthorizationCode,
  inputs: {
    authorizeUrl: {
      label: "Authorize URL",
      placeholder: "Authorize URL",
      type: "string",
      required: true,
      shown: true,
      comments: "The OAuth 2.0 Authorization URL for the API",
    },
    tokenUrl: {
      label: "Token URL",
      placeholder: "Token URL",
      type: "string",
      required: true,
      shown: true,
      comments: "The OAuth 2.0 Token URL for the API",
    },
    scopes: {
      label: "Scopes",
      placeholder: "Scopes",
      type: "string",
      required: false,
      shown: true,
      comments: "Space separated OAuth 2.0 permission scopes for the API",
      default: "",
    },
    clientId: {
      label: "Client ID",
      placeholder: "Client ID",
      type: "string",
      required: true,
      shown: true,
      comments: "Client Identifier of your app for the API",
    },
    clientSecret: {
      label: "Client Secret",
      placeholder: "Client Secret",
      type: "password",
      required: true,
      shown: true,
      comments: "Client Secret of your app for the API",
    },
    headers: {
      label: "Headers",
      type: "string",
      collection: "keyvaluelist",
      required: false,
      shown: true,
      comments: "Additional header to supply to authorization requests",
    },
  },
});

export default [<%= connection.key %>];
