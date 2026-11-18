import type {
  ConfigPages,
  ConfigVar,
  ConfigVars,
  Connection,
  DataSourceConfigVar,
  FieldMappingSide,
  FieldMappingValue,
} from "@prismatic-io/spectral";
import { isFieldMappingConfigVar, OAuth2Type } from "@prismatic-io/spectral";
import { expectAssignable, expectNotAssignable, expectNotType, expectType } from "tsd";

type RawConnectionElems = ConfigPages[keyof ConfigPages]["elements"];
expectAssignable<"A Connection" | "Ref Connection">(null as unknown as keyof RawConnectionElems);

type ConnectionElems = ConfigPages[keyof ConfigPages]["elements"];
expectAssignable<"A Connection" | "Ref Connection">(null as unknown as keyof ConnectionElems);

expectAssignable<Connection>(null as unknown as ConfigVars["A Connection"]);
expectAssignable<Connection>(null as unknown as ConfigVars["Ref Connection"]);
expectAssignable<Connection>(null as unknown as ConfigVars["My Customer Connection"]);
expectAssignable<Connection>(null as unknown as ConfigVars["My User Connection"]);

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

// A field mapping config var gives the flow its rows.
expectType<FieldMappingValue>(null as unknown as ConfigVars["Contact Field Mapping"]);

const staticFieldMappingSide = { staticOptions: [{ key: "Email", label: "Email" }] };

// Each side is a picklist data source reference, an inline picklist, or static options.
expectAssignable<ConfigVar>({
  stableKey: "reference-field-mapping",
  dataType: "fieldMapping",
  source: {
    component: "slack",
    key: "selectChannels",
    values: {
      connection: { configVar: "A String" },
      includeImChannels: { value: true },
      includeMultiPartyImchannels: { value: true },
      includePublicChannels: { value: true },
      includePrivateChannels: { value: false },
      showIdInDropdown: { value: false },
    },
  },
  destination: staticFieldMappingSide,
});

expectAssignable<ConfigVar>({
  stableKey: "inline-field-mapping",
  dataType: "fieldMapping",
  source: { perform: async () => Promise.resolve({ result: ["email"] }) },
  destination: { perform: async () => Promise.resolve({ result: [{ key: "Email" }] }) },
});

expectAssignable<ConfigVar>({
  stableKey: "static-field-mapping",
  dataType: "fieldMapping",
  source: staticFieldMappingSide,
  destination: staticFieldMappingSide,
  rules: [
    { mode: "static", sourceField: "email", destField: "Email" },
    { mode: "required", sourceField: "lastName" },
    { mode: "optional", destField: "Email" },
  ],
  allowAdditionalMappings: true,
  allowNewFields: false,
});

// A side cannot reference a data source that is not a picklist.
expectNotAssignable<ConfigVar>({
  stableKey: "string-data-source-field-mapping",
  dataType: "fieldMapping",
  source: {
    component: "example",
    key: "stringDataSource",
    values: { bar: { value: "foo" } },
  },
  destination: staticFieldMappingSide,
});

// A field mapping has no default value.
expectNotAssignable<ConfigVar>({
  stableKey: "default-field-mapping",
  dataType: "fieldMapping",
  source: staticFieldMappingSide,
  destination: staticFieldMappingSide,
  defaultValue: [{ key: "a", value: "b" }],
});

// A field mapping is not a collection.
expectNotAssignable<ConfigVar>({
  stableKey: "collection-field-mapping",
  dataType: "fieldMapping",
  source: staticFieldMappingSide,
  destination: staticFieldMappingSide,
  collectionType: "valuelist",
});

// A static rule needs both fields.
expectNotAssignable<ConfigVar>({
  stableKey: "static-rule-field-mapping",
  dataType: "fieldMapping",
  source: staticFieldMappingSide,
  destination: staticFieldMappingSide,
  rules: [{ mode: "static", sourceField: "a" }],
});

// A required or optional rule needs at least one field.
expectNotAssignable<ConfigVar>({
  stableKey: "empty-rule-field-mapping",
  dataType: "fieldMapping",
  source: staticFieldMappingSide,
  destination: staticFieldMappingSide,
  rules: [{ mode: "required" }],
});

// A rule mode is required, optional or static.
expectNotAssignable<ConfigVar>({
  stableKey: "locked-rule-field-mapping",
  dataType: "fieldMapping",
  source: staticFieldMappingSide,
  destination: staticFieldMappingSide,
  rules: [{ mode: "locked", sourceField: "a", destField: "b" }],
});

// A field mapping needs both sides.
expectNotAssignable<ConfigVar>({
  stableKey: "one-side-field-mapping",
  dataType: "fieldMapping",
  source: staticFieldMappingSide,
});

declare const anyConfigVar: ConfigVar;
if (isFieldMappingConfigVar(anyConfigVar)) {
  expectType<"fieldMapping">(anyConfigVar.dataType);
  expectType<FieldMappingSide>(anyConfigVar.source);
}
