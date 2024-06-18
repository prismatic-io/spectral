import {
  configVar,
  connectionConfigVar,
  OAuth2Type,
  input,
  configPage,
  dataSourceConfigVar,
  ConfigVarResultCollection,
  componentManifest,
} from "@prismatic-io/spectral";
import { expectAssignable } from "tsd";
import {
  ConfigPages,
  ConfigPageConfigVarReferences,
  ConnectionReference,
} from "@prismatic-io/spectral";

(
  pages: ConfigPages,
  references: ConfigPageConfigVarReferences,
  createConnection: (
    thirdPageConnection: ConnectionReference<
      ConfigPageConfigVarReferences["Third Page"]
    >
  ) => void
) => {
  pages["Third Page"].elements["A Data Source"];
  references["Third Page"]["A String"];

  createConnection({
    key: "slackOAuth",
    component: "slack",
    values: {},
  });
};

export const configPages = {
  "First Page": configPage({
    elements: {
      "A Connection": connectionConfigVar({
        dataType: "connection",
        stableKey: "a-connection",
        oauth2Type: OAuth2Type.AuthorizationCode,
        inputs: {
          authorizeUrl: input({
            label: "Authorize URL",
            type: "string",
          }),
          // more inputs
        },
      }),
      "Ref Connection": connectionConfigVar({
        dataType: "connection",
        stableKey: "ref-connection",
        connection: {
          component: "example",
          key: "exampleConnection",
          values: { foo: "bar" },
        },
      }),
    },
  }),
  "Second Page": configPage({
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
    },
  }),
  "Third Page": configPage({
    elements: {
      "A Data Source": dataSourceConfigVar({
        stableKey: "a-data-source",
        dataSourceType: "jsonForm",
        perform: async (context) => {
          // Currently limited to a relatively untyped collection
          expectAssignable<ConfigVarResultCollection>(context.configVars);

          return Promise.resolve({
            result: {
              schema: {},
              uiSchema: { type: "VerticalLayout" },
            },
          });
        },
      }),
      "Ref Data Source": dataSourceConfigVar({
        stableKey: "ref-data-source",
        dataSourceType: "jsonForm",
        dataSource: {
          component: "example",
          key: "exampleDataSource",
          values: { bar: { value: "foo" } },
        },
      }),
    },
  }),
  "Fourth Page": configPage({
    elements: {
      "Fourth Page String": configVar({
        stableKey: "fourth-page-string",
        dataType: "string",
      }),
    },
  }),
};

export const componentRegistry = {
  example: componentManifest({
    key: "example",
    public: true,
    actions: {},
    triggers: {},
    dataSources: {
      exampleDataSource: (inputs: { bar: string }) =>
        Promise.resolve<unknown>(inputs),
    },
    connections: {
      exampleConnection: (inputs: { foo: string }) =>
        Promise.resolve<unknown>(inputs),
    },
  }),
  slack: componentManifest({
    key: "slack",
    public: true,
    actions: {},
    triggers: {},
    dataSources: {
      selectChannels: (inputs: {
        connection: string;
        includeImChannels: boolean;
        includeMultiPartyImchannels: boolean;
        includePublicChannels: boolean;
        includePrivateChannels: boolean;
        showIdInDropdown: boolean;
      }) => Promise.resolve<unknown>(inputs),
    },
    connections: {
      slackOAuth: (inputs: {
        clientId: string;
        clientSecret: string;
        signingSecret: string;
      }) => Promise.resolve<unknown>(inputs),
    },
  }),
  http: componentManifest({
    key: "http",
    public: true,
    actions: {},
    triggers: {
      hmac: (inputs: { secret: string; secret2: string }) =>
        Promise.resolve<unknown>(inputs),
    },
    dataSources: {},
    connections: {},
  }),
};
