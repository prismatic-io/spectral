import { expectAssignable } from "tsd";
import {
  Connection,
  ElementToRuntimeType,
  JSONForm,
  ConfigPages,
  DataSourceReference,
  ConnectionReference,
  TriggerReference,
  ActionReference,
} from "..";

// Test connection runtime type translation
type DeterminedConnectionRuntimeType = ElementToRuntimeType<
  ConfigPages["First Page"]["elements"]["A Connection"]
>;
expectAssignable<Connection>(
  null as unknown as DeterminedConnectionRuntimeType
);

// Test dataSource runtime type translation
type DeterminedDataSourceRuntimeType = ElementToRuntimeType<
  ConfigPages["Third Page"]["elements"]["A Data Source"]
>;
expectAssignable<JSONForm>(null as unknown as DeterminedDataSourceRuntimeType);

type AllComponentReferences =
  | DataSourceReference
  | ConnectionReference
  | TriggerReference
  | ActionReference;

const createRef = <TComponentRef extends AllComponentReferences>(
  ref: TComponentRef
): TComponentRef => {
  return ref;
};

const slackRef = createRef<AllComponentReferences>({
  component: "slack",
  key: "selectChannels",
  values: {
    connection: { configVar: "A String" },
  },
});

expectAssignable<
  | "exampleDataSource"
  | "exampleConnection"
  | "slackOAuth"
  | "selectChannels"
  | "hmac"
>(slackRef.key);

const hmacRef = createRef<TriggerReference>({
  component: "http",
  key: "hmac",
  values: {
    secret: { value: "secret" },
    secret2: { value: "secret2" },
  },
});
expectAssignable<"hmac">(hmacRef.key);

const slackOAuthRef = createRef<ConnectionReference>({
  component: "slack",
  key: "slackOAuth",
  values: {
    clientId: { value: "id" },
    clientSecret: { value: "secret" },
    signingSecret: { value: "sign" },
  },
});
expectAssignable<"exampleConnection" | "slackOAuth">(slackOAuthRef.key);

const slackChannelsRef = createRef<DataSourceReference>({
  component: "slack",
  key: "selectChannels",
  values: {
    connection: { configVar: "A String" },
    includeImChannels: { value: "true" },
    includeMultiPartyImchannels: { value: "true" },
    includePublicChannels: { value: "true" },
    includePrivateChannels: { value: "true" },
    showIdInDropdown: { value: "true" },
  },
});
expectAssignable<"exampleDataSource" | "selectChannels">(slackChannelsRef.key);
