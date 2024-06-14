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

export const configPages = {
  "First Page": configPage({
    elements: {
      "A Connection": connectionConfigVar({
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
        stableKey: "ref-connection",
        connection: {
          component: "example",
          key: "exampleConnection",
          values: { foo: { value: "bar" } },
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
      exampleDataSource: {
        inputs: {
          bar: "string",
        },
      },
    },
    connections: {
      exampleConnection: {
        inputs: {
          foo: "string",
        },
      },
    },
  }),
  slack: componentManifest({
    key: "slack",
    public: true,
    actions: {},
    triggers: {},
    dataSources: {
      selectChannels: {
        inputs: {
          connection: "string",
          includeImChannels: "boolean",
          includeMultiPartyImchannels: "boolean",
          includePublicChannels: "boolean",
          includePrivateChannels: "boolean",
          showIdInDropdown: "boolean",
        },
      },
    },
    connections: {
      slackOAuth: {
        inputs: {
          clientId: "string",
          clientSecret: "string",
          signingSecret: "string",
        },
      },
    },
  }),
  http: componentManifest({
    key: "http",
    public: true,
    actions: {},
    triggers: {
      hmac: {
        inputs: {
          secret: "string",
          secret2: "string",
        },
      },
    },
    dataSources: {},
    connections: {},
  }),
};
