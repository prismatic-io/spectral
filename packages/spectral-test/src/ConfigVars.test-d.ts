import type {
  ConfigPages,
  ConfigVar,
  ConfigVars,
  Connection,
  DataSourceConfigVar,
} from "@prismatic-io/spectral";
import { OAuth2Type } from "@prismatic-io/spectral";
import type { ValueOf } from "@prismatic-io/spectral/dist/types/utils";
import { expectAssignable, expectNotType } from "tsd";

type RawConnectionElems = ValueOf<ConfigPages>["elements"];
expectAssignable<"A Connection" | "Ref Connection">(null as unknown as keyof RawConnectionElems);

type ConnectionElems = ValueOf<ConfigPages>["elements"];
expectAssignable<"A Connection" | "Ref Connection">(null as unknown as keyof ConnectionElems);

expectAssignable<Connection>(null as unknown as ConfigVars["A Connection"]);
expectAssignable<Connection>(null as unknown as ConfigVars["Ref Connection"]);
expectAssignable<Connection>(null as unknown as ConfigVars["My Customer Connection"]);

expectAssignable<ConfigVar>({
  stableKey: "cni-oauth-connection",
  dataType: "connection",
  oauth2Type: OAuth2Type.AuthorizationCode,
  oauth2Config: {
    allowedTokenParams: ["state"],
    overrideGrantType: "authorization_code",
    oAuthSuccessRedirectUri: "https://example.com/success",
    oAuthFailureRedirectUri: "https://example.com/failure",
  },
  inputs: {
    authorizeUrl: { label: "Authorize URL", type: "string", required: true },
    tokenUrl: { label: "Token URL", type: "string", required: true },
    scopes: { label: "Scopes", type: "string", required: true },
    clientId: { label: "Client ID", type: "string", required: true },
    clientSecret: { label: "Client Secret", type: "password", required: true },
  },
});

expectAssignable<ConfigVar>({
  stableKey: "cni-client-credentials-connection",
  dataType: "connection",
  oauth2Type: OAuth2Type.ClientCredentials,
  oauth2Config: {
    oAuthSuccessRedirectUri: "https://example.com/success",
    oAuthFailureRedirectUri: "https://example.com/failure",
  },
  inputs: {
    tokenUrl: { label: "Token URL", type: "string", required: true },
    scopes: { label: "Scopes", type: "string", required: true },
    clientId: { label: "Client ID", type: "string", required: true },
    clientSecret: { label: "Client Secret", type: "password", required: true },
  },
});

// Having both a dataSource & dataSourceType in a DataSourceConfigVar is invalid
expectNotType<DataSourceConfigVar>({
  stableKey: "jsonFormDataSourceConfigVar",
  dataSource: {
    component: "example",
    key: "jsonFormDataSource",
    values: { bar: { configVar: "" } },
  },
  dataSourceType: "jsonForm",
  perform: () =>
    Promise.resolve({
      result: { uiSchema: { type: "" }, schema: {}, data: {} },
    }),
});

// validationMode should only be accepted by jsonForm and component reference config vars
expectAssignable<ConfigVar>({
  stableKey: "jsonFormConfigVar",
  dataType: "jsonForm",
  validationMode: "ValidateAndHide",
});

expectAssignable<DataSourceConfigVar>({
  stableKey: "jsonFormDataSourceConfigVar",
  dataSourceType: "jsonForm",
  perform: () =>
    Promise.resolve({
      result: { uiSchema: { type: "" }, schema: {}, data: {} },
    }),
  validationMode: "NoValidation",
});

expectAssignable<DataSourceConfigVar>({
  stableKey: "componentRefConfigVar",
  dataSource: {
    component: "example",
    key: "jsonFormDataSource",
    values: { bar: { configVar: "" } },
  },
  validationMode: "NoValidation",
});

expectNotType<DataSourceConfigVar>({
  dataSourceType: "boolean",
  stableKey: "booleanConfigVar",
  validationMode: "NoValidation",
});

// Subset of data source types support collections.
expectAssignable<DataSourceConfigVar>({
  perform: async () => Promise.resolve({ result: ["string"] }),
  stableKey: "ds",
  dataSourceType: "picklist",
  collectionType: "valuelist",
});

const createDataSourceConfigVar = (configVar: DataSourceConfigVar) => configVar;

createDataSourceConfigVar({
  perform: async () => Promise.resolve({ result: { value: "string" } }),
  stableKey: "ds",
  dataSourceType: "schedule",
  collectionType: "valuelist",
});
