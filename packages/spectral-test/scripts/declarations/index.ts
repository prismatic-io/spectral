// A callable package's entry, whose declarations scripts/declarations/tsconfig.json emits as a
// component's npm build does. Every type they name has to be reachable from spectral's exports.
import {
  action,
  callableComponent,
  component,
  connection,
  input,
  OAuth2Type,
  oauth2Connection,
  onPremConnection,
} from "@prismatic-io/spectral";

const display = { label: "Declarations", description: "Declarations" };

export const apiKey = connection({
  key: "apiKey",
  display,
  inputs: { token: input({ type: "password", label: "Token", required: true }) },
});

export const oauth = oauth2Connection({
  key: "oauth",
  display,
  oauth2Type: OAuth2Type.ClientCredentials,
  inputs: {
    tokenUrl: { type: "string", label: "Token URL", default: "https://example.com/token" },
    scopes: { type: "string", label: "Scopes" },
    clientId: { type: "string", label: "Client ID" },
    clientSecret: { type: "password", label: "Client secret" },
  },
});

export const onPrem = onPremConnection({
  key: "onPrem",
  display,
  inputs: {
    host: { type: "string", label: "Host", onPremControlled: true },
    port: { type: "string", label: "Port", onPremControlled: true },
  },
});

const ping = action({
  display,
  inputs: { connection: input({ type: "connection", label: "Connection", required: true }) },
  perform: async () => ({ data: "pong" }),
});

export default callableComponent(
  component({
    key: "declarations",
    public: false,
    display: { ...display, iconPath: "icon.png" },
    actions: { ping },
    connections: [apiKey, oauth, onPrem],
  }),
);
