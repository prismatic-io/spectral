import { expectAssignable } from "tsd";
import {
  ComponentSelectorType,
  Connection,
  ElementToRuntimeType,
  JSONForm,
  KeyValuePair,
  ToComponentReferences,
  configPage,
  configVar,
  reference,
} from "..";

interface HmacWebhookTrigger {
  type: "trigger";
  component: "hash";
  key: "hmacWebhookTrigger";
  values: {
    statusCode?: string;
    contentType?: string;
    headers?: KeyValuePair[];
    body?: string;
    hmacHeaderName: string;
    secretKey: string;
    hashFunction: string;
  };
}

interface SlackOAuthConnection {
  type: "connection";
  component: "slack";
  key: "slackOAuth";
  values: {
    authorizeUrl?: string;
    tokenUrl?: string;
    revokeUrl?: string;
    scopes?: string;
    isUser?: string;
    clientId: string;
    clientSecret: string;
    signingSecret: string;
  };
}

interface SlackSelectChannelsDataSource {
  type: "dataSource";
  component: "slack";
  key: "selectChannels";
  values: {
    connection: string;
    includeImChannels?: string;
    includeMultiPartyImchannels?: string;
    includePublicChannels?: string;
    includePrivateChannels?: string;
    showIdInDropdown?: string;
  };
}

type Components =
  | HmacWebhookTrigger
  | SlackOAuthConnection
  | SlackSelectChannelsDataSource;

const configPages = {
  Page: configPage({
    elements: {
      "A String": configVar({
        stableKey: "a-string",
        dataType: "string",
      }),
      "A Picklist": configVar({
        stableKey: "a-picklist",
        dataType: "picklist",
        pickList: ["a", "b", "c"],
      }),
      "A Connection": reference<Components>().connection({
        stableKey: "a-connection",
        connection: {
          component: "slack",
          key: "slackOAuth",
          values: {
            clientId: { value: "id" },
            clientSecret: { value: "secret" },
            signingSecret: { value: "sign" },
          },
        },
      }),
      "A Data Source": reference<Components>().dataSource({
        stableKey: "ref-data-source",
        dataSourceType: "jsonForm",
        dataSource: {
          component: "slack",
          key: "selectChannels",
          values: { connection: { configVar: "A Connection" } },
        },
      }),
    },
  }),
};
type ConfigPages = typeof configPages;

// Test connection runtime type translation
type DeterminedConnectionRuntimeType = ElementToRuntimeType<
  ConfigPages["Page"]["elements"]["A Connection"]
>;
expectAssignable<Connection>(
  null as unknown as DeterminedConnectionRuntimeType
);

// Test dataSource runtime type translation
type DeterminedDataSourceRuntimeType = ElementToRuntimeType<
  ConfigPages["Page"]["elements"]["A Data Source"]
>;
expectAssignable<JSONForm>(null as unknown as DeterminedDataSourceRuntimeType);

type AllComponentReferences = ToComponentReferences<
  ComponentSelectorType,
  Components,
  ConfigPages
>;
const slackRef: AllComponentReferences = {
  component: "slack",
  key: "selectChannels",
  values: {
    connection: { configVar: "A String" },
  },
};
expectAssignable<"slackOAuth" | "selectChannels">(slackRef.key);

type TriggerComponentReferences = ToComponentReferences<
  "trigger",
  Components,
  ConfigPages
>;
const hmacRef: TriggerComponentReferences = {
  component: "hash",
  key: "hmacWebhookTrigger",
  values: {
    hashFunction: { value: "sha256" },
    hmacHeaderName: { configVar: "A Picklist" },
    secretKey: { value: "oi" },
  },
};
expectAssignable<"hmacWebhookTrigger">(hmacRef.key);

type ConnectionComponentReferences = ToComponentReferences<
  "connection",
  Components
>;
const slackOAuthRef: ConnectionComponentReferences = {
  component: "slack",
  key: "slackOAuth",
  values: {
    clientId: { value: "id" },
    clientSecret: { value: "secret" },
    signingSecret: { value: "sign" },
  },
};
expectAssignable<"slackOAuth">(slackOAuthRef.key);

type DataSourceComponentReferences = ToComponentReferences<
  "dataSource",
  Components,
  ConfigPages
>;
const slackChannelsRef: DataSourceComponentReferences = {
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
};
expectAssignable<"selectChannels">(slackChannelsRef.key);
