import { expectAssignable } from "tsd";
import {
  flow,
  integration,
  configVar,
  connectionConfigVar,
  OAuth2Type,
  input,
  configPage,
  Connection,
  dataSourceConfigVar,
  JSONForm,
  ConfigVarResultCollection,
  TriggerPayload,
  componentManifest,
} from "..";

const configPages = {
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

type TConfigPages = typeof configPages;
type TComponentRegistry = typeof componentRegistry;

declare module ".." {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface IntegrationDefinitionConfigPages extends TConfigPages {}

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface IntegrationDefinitionComponentRegistry extends TComponentRegistry {}
}

const basicFlow = flow({
  name: "Basic Flow",
  stableKey: "basic-flow",
  description: "This is a basic flow",
  onTrigger: async (context, payload, params) => {
    expectAssignable<Connection>(context.configVars["A Connection"]);
    expectAssignable<Connection>(context.configVars["Ref Connection"]);
    expectAssignable<string>(context.configVars["A String"]);
    expectAssignable<string>(context.configVars["A Picklist"]);
    expectAssignable<JSONForm>(context.configVars["A Data Source"]);
    expectAssignable<JSONForm>(context.configVars["Ref Data Source"]);
    expectAssignable<string>(context.configVars["Fourth Page String"]);

    expectAssignable<Record<string, unknown>>(params);

    return Promise.resolve({ payload });
  },
  onExecution: async (context, params) => {
    expectAssignable<Connection>(context.configVars["A Connection"]);
    expectAssignable<Connection>(context.configVars["Ref Connection"]);
    expectAssignable<string>(context.configVars["A String"]);
    expectAssignable<string>(context.configVars["A Picklist"]);
    expectAssignable<JSONForm>(context.configVars["A Data Source"]);
    expectAssignable<JSONForm>(context.configVars["Ref Data Source"]);
    expectAssignable<string>(context.configVars["Fourth Page String"]);

    expectAssignable<TriggerPayload>(params.onTrigger.results);

    return Promise.resolve({ data: "SUCCESS" });
  },
  onInstanceDeploy: async (context) => {
    expectAssignable<Connection>(context.configVars["A Connection"]);
    expectAssignable<Connection>(context.configVars["Ref Connection"]);
    expectAssignable<string>(context.configVars["A String"]);
    expectAssignable<string>(context.configVars["A Picklist"]);
    expectAssignable<JSONForm>(context.configVars["A Data Source"]);
    expectAssignable<JSONForm>(context.configVars["Ref Data Source"]);
    expectAssignable<string>(context.configVars["Fourth Page String"]);

    return Promise.resolve();
  },
  onInstanceDelete: async (context) => {
    expectAssignable<Connection>(context.configVars["A Connection"]);
    expectAssignable<Connection>(context.configVars["Ref Connection"]);
    expectAssignable<string>(context.configVars["A String"]);
    expectAssignable<string>(context.configVars["A Picklist"]);
    expectAssignable<JSONForm>(context.configVars["A Data Source"]);
    expectAssignable<JSONForm>(context.configVars["Ref Data Source"]);
    expectAssignable<string>(context.configVars["Fourth Page String"]);

    return Promise.resolve();
  },
});

const triggerFlow = flow({
  name: "Trigger Flow",
  stableKey: "trigger-flow",
  description: "This is a trigger flow",
  onTrigger: {
    component: "http",
    key: "hmac",
    values: {
      secret: { value: "hello" },
      secret2: { configVar: "Fourth Page String" },
    },
  },
  onExecution: async () => {
    return Promise.resolve({ data: "SUCCESS" });
  },
});

integration({
  name: "Config Pages",
  flows: [basicFlow, triggerFlow],
  configPages,
  componentRegistry,
});
