import {
  connection,
  OAuth2Type,
  type OnPremConnectionDefinition,
  oauth2Connection,
  onPremConnection,
} from "@prismatic-io/spectral";
import { expectAssignable, expectError, expectNotAssignable } from "tsd";

const valid = onPremConnection({
  key: "basic",
  display: {
    label: "Basic Connection",
    description: "",
  },
  inputs: {
    host: {
      label: "Host",
      placeholder: "Host",
      type: "string",
      required: true,
      shown: true,
      onPremControlled: true,
      example: "192.168.0.1",
    },
    port: {
      label: "Port",
      placeholder: "Port",
      type: "string",
      required: true,
      shown: true,
      onPremControlled: true,
      default: "1433",
    },
    username: {
      label: "Username",
      placeholder: "Username",
      type: "string",
      required: false,
      shown: true,
    },
    password: {
      label: "Password",
      placeholder: "Password",
      type: "password",
      required: false,
      shown: true,
    },
  },
});
expectAssignable<OnPremConnectionDefinition>(valid);

const invalid = {
  key: "basic",
  display: {
    label: "Basic Connection",
    description: "",
  },
  inputs: {
    username: {
      label: "Username",
      placeholder: "Username",
      type: "string",
      required: false,
      shown: true,
    },
    password: {
      label: "Password",
      placeholder: "Password",
      type: "password",
      required: false,
      shown: true,
    },
  },
};
expectNotAssignable<OnPremConnectionDefinition>(invalid);

expectError(
  connection({
    key: "basic",
    stableKey: "basic-stable-key",
    display: { label: "Basic", description: "" },
    inputs: {},
  }),
);

expectError(onPremConnection({ ...valid, stableKey: "on-prem-stable-key" }));

const oauthInputs = {
  authorizeUrl: { label: "Authorize URL", type: "string" as const, required: true },
  tokenUrl: { label: "Token URL", type: "string" as const, required: true },
  scopes: { label: "Scopes", type: "string" as const, required: true },
  clientId: { label: "Client ID", type: "string" as const, required: true },
  clientSecret: { label: "Client Secret", type: "password" as const, required: true },
};

expectError(
  oauth2Connection({
    key: "oauth",
    stableKey: "oauth-stable-key",
    display: { label: "OAuth", description: "" },
    oauth2Type: OAuth2Type.AuthorizationCode,
    inputs: oauthInputs,
  }),
);

expectError(
  oauth2Connection({
    key: "oauth",
    display: { label: "OAuth", description: "" },
    oauth2Type: OAuth2Type.AuthorizationCode,
    oauth2Config: {
      oAuthSuccessRedirectUri: "https://example.com/success",
      oAuthFailureRedirectUri: "https://example.com/failure",
    },
    inputs: oauthInputs,
  }),
);
