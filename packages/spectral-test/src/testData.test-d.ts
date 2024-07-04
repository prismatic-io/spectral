import {
  configVar,
  connectionConfigVar,
  OAuth2Type,
  input,
  configPage,
  dataSourceConfigVar,
  ConfigVarResultCollection,
  componentManifest,
  ObjectSelection,
  JSONForm,
} from "@prismatic-io/spectral";
import { expectAssignable } from "tsd";

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
      "JSON Form Data Source": dataSourceConfigVar({
        stableKey: "json-form-data-source",
        dataSourceType: "jsonForm",
        perform: async (context) => {
          // Currently limited to a relatively untyped collection
          expectAssignable<ConfigVarResultCollection>(context.configVars);

          const result: JSONForm = {
            schema: {},
            uiSchema: { type: "VerticalLayout" },
          };

          return Promise.resolve({
            result,
          });
        },
      }),
      "Object Selection Data Source": dataSourceConfigVar({
        stableKey: "object-selection-data-source",
        dataSourceType: "objectSelection",
        perform: async (context) => {
          // Currently limited to a relatively untyped collection
          expectAssignable<ConfigVarResultCollection>(context.configVars);

          const result: ObjectSelection = [
            {
              object: {
                key: "object 1",
                label: "Object 1",
              },
            },
          ];

          return Promise.resolve({
            result,
          });
        },
      }),
      "Ref JSON Form Data Source": dataSourceConfigVar({
        stableKey: "ref-data-source",
        dataSource: {
          component: "example",
          key: "jsonFormDataSource",
          values: { bar: { value: "foo" } },
        },
      }),
      "Ref String Data Source": dataSourceConfigVar({
        stableKey: "ref-picklist-source",
        dataSource: {
          component: "example",
          key: "stringDataSource",
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
    public: false,
    signature: "example-signature" as const,
    actions: {},
    triggers: {},
    dataSources: {
      jsonFormDataSource: {
        dataSourceType: "jsonForm",
        perform: (inputs: { bar: string }) =>
          Promise.resolve<unknown>(inputs.bar),
        inputs: {
          bar: {
            inputType: "string",
            required: true,
          },
        },
      },
      stringDataSource: {
        dataSourceType: "string",
        perform: (inputs: { bar: string }) => Promise.resolve(inputs.bar),
        inputs: {
          bar: {
            inputType: "string",
            required: true,
          },
        },
      },
    },
    connections: {
      exampleConnection: {
        perform: (inputs: { foo: string }) => Promise.resolve<unknown>(inputs),
        inputs: {},
      },
    },
  }),
  slack: componentManifest({
    key: "slack",
    public: true,
    signature: "slack-signature" as const,
    actions: {},
    triggers: {},
    dataSources: {
      selectChannels: {
        dataSourceType: "picklist",
        perform: (inputs: {
          connection: string;
          includeImChannels: boolean;
          includeMultiPartyImchannels: boolean;
          includePublicChannels: boolean;
          includePrivateChannels: boolean;
          showIdInDropdown: boolean;
        }) => Promise.resolve<unknown>(inputs),
        inputs: {},
      },
    },
    connections: {
      slackOAuth: {
        perform: (inputs: {
          clientId: string;
          clientSecret: string;
          signingSecret: string;
        }) => Promise.resolve<unknown>(inputs),
        inputs: {},
      },
    },
  }),
  http: componentManifest({
    key: "http",
    public: true,
    signature: "http-signature" as const,
    actions: {},
    triggers: {
      hmac: {
        perform: (inputs: { secret: string; secret2: string }) =>
          Promise.resolve<unknown>(inputs),
        inputs: {},
      },
    },
    dataSources: {},
    connections: {},
  }),
};
