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
  reference,
} from "..";

interface ExampleConnection {
  type: "connection";
  component: "example";
  key: "example-connection";
  values: { foo: string };
}
interface ExampleDataSource {
  type: "dataSource";
  component: "data-source-example";
  key: "example-data-source";
  values: { bar: string };
}
interface ExampleTrigger {
  type: "trigger";
  component: "http";
  key: "hmac";
  values: {
    secret: string;
    secret2: string;
  };
}
type Components = ExampleConnection | ExampleDataSource | ExampleTrigger;

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
      "Ref Connection": reference<Components>().connection({
        stableKey: "ref-connection",
        connection: {
          component: "example",
          key: "example-connection",
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
      "Ref Data Source": reference<Components>().dataSource({
        stableKey: "ref-data-source",
        dataSourceType: "jsonForm",
        dataSource: {
          component: "data-source-example",
          key: "example-data-source",
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
type ConfigPages = typeof configPages;

const basicFlow = flow<ConfigPages>({
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

const triggerFlow = flow<ConfigPages, Components>({
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
});
