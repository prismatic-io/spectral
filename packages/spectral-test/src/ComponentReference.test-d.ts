import {
  DataSourceReference,
  ConnectionReference,
  TriggerReference,
  ActionReference,
} from "@prismatic-io/spectral";
import { expectAssignable } from "tsd";

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
    includeImChannels: { value: true },
    includeMultiPartyImchannels: { value: true },
    includePublicChannels: { value: true },
    includePrivateChannels: { value: false },
    showIdInDropdown: { value: false },
  },
});

expectAssignable<
  | "jsonFormDataSource"
  | "stringDataSource"
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
    includeImChannels: { value: true },
    includeMultiPartyImchannels: { value: true },
    includePublicChannels: { value: true },
    includePrivateChannels: { value: false },
    showIdInDropdown: { value: false },
  },
});
expectAssignable<"jsonFormDataSource" | "stringDataSource" | "selectChannels">(
  slackChannelsRef.key
);
