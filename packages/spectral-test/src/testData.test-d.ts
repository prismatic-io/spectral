import {
  configVar,
  connectionDefinitionConfigVar,
  connectionReferenceConfigVar,
  OAuth2Type,
  input,
  configPage,
  dataSourceDefinitionConfigVar,
  dataSourceReferenceConfigVar,
  ConfigVarResultCollection,
  componentManifest,
  ObjectSelection,
  JSONForm,
  organizationActivatedConnection,
} from "@prismatic-io/spectral";
import { expectAssignable } from "tsd";

export const configPages = {
  "First Page": configPage({
    elements: {
      "A Connection": connectionDefinitionConfigVar({
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
      "Ref Connection": connectionReferenceConfigVar({
        dataType: "connection",
        stableKey: "ref-connection",
        connection: {
          component: "example",
          key: "exampleConnection",
          values: { foo: { value: "bar" } },
        },
      }),
      "On Prem Connection": connectionReferenceConfigVar({
        dataType: "connection",
        stableKey: "on-prem-connection",
        connection: {
          component: "example",
          key: "onPremConnection",
          onPremiseConnectionConfig: "allowed",
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
      "JSON Form Data Source": dataSourceDefinitionConfigVar({
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
      "Object Selection Data Source": dataSourceDefinitionConfigVar({
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
      "Ref JSON Form Data Source": dataSourceReferenceConfigVar({
        stableKey: "ref-data-source",
        dataSource: {
          component: "example",
          key: "jsonFormDataSource",
          values: { bar: { value: "foo" } },
        },
      }),
      "Ref String Data Source": dataSourceReferenceConfigVar({
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
        perform: (inputs: { bar: string }) => Promise.resolve<unknown>(inputs.bar),
        inputs: {
          bar: {
            inputType: "string",
            required: true,
          },
        },
        key: "jsonFormDataSource",
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
        key: "stringDataSource",
      },
    },
    connections: {
      exampleConnection: {
        perform: (inputs: { foo: string }) => Promise.resolve<unknown>(inputs),
        inputs: {},
        key: "exampleConnection",
      },
      onPremConnection: {
        perform: (inputs: { foo: string }) => Promise.resolve(inputs),
        inputs: {},
        onPremAvailable: true,
        key: "onPremConnection",
      },
    },
  }),
  slack: componentManifest({
    key: "slack",
    public: true,
    signature: "slack-signature" as const,
    actions: {
      postMessage: {
        perform: (inputs: { connection: string; channel: string }) =>
          Promise.resolve<unknown>(inputs),
        inputs: {
          connection: {
            inputType: "connection",
            required: true,
          },
          channel: {
            inputType: "string",
            required: true,
          },
        },
      },
    },
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
        key: "selectChannels",
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
        key: "slackOAuth",
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
        perform: (inputs: { secret: string; secret2: string }) => Promise.resolve<unknown>(inputs),
        inputs: {},
        key: "hmac",
      },
    },
    dataSources: {},
    connections: {},
  }),
};

export const scopedConfigVars = {
  "My Customer Connection": organizationActivatedConnection({
    stableKey: "my-customer-connection-stable-key",
  }),
};
