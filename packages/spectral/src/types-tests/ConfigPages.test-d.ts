import { expectAssignable } from "tsd";
import {
  flow,
  integration,
  configVar,
  ConfigVarDataType,
  connectionConfigVar,
  OAuth2Type,
  input,
  configPage,
  Connection,
  dataSourceConfigVar,
  JSONForm,
  ConfigVarResultCollection,
  TriggerPayload,
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
    },
  }),
  "Second Page": configPage({
    elements: {
      "A String": configVar({
        stableKey: "a-string",
        dataType: ConfigVarDataType.String,
      }),
      "A Picklist": configVar({
        stableKey: "a-picklist",
        dataType: ConfigVarDataType.Picklist,
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
    },
  }),
  "Fourth Page": configPage({
    elements: {
      "Fourth Page String": configVar({
        stableKey: "fourth-page-string",
        dataType: ConfigVarDataType.String,
      }),
    },
  }),
};

const basicFlow = flow<typeof configPages>({
  name: "Basic Flow",
  stableKey: "basic-flow",
  description: "This is a basic flow",
  onTrigger: async (context, payload, params) => {
    expectAssignable<Connection>(context.configVars["A Connection"]);
    expectAssignable<string>(context.configVars["A String"]);
    expectAssignable<string>(context.configVars["A Picklist"]);
    expectAssignable<JSONForm>(context.configVars["A Data Source"]);
    expectAssignable<string>(context.configVars["Fourth Page String"]);

    expectAssignable<Record<string, unknown>>(params);

    return Promise.resolve({ payload });
  },
  onExecution: async (context, params) => {
    expectAssignable<Connection>(context.configVars["A Connection"]);
    expectAssignable<string>(context.configVars["A String"]);
    expectAssignable<string>(context.configVars["A Picklist"]);
    expectAssignable<JSONForm>(context.configVars["A Data Source"]);
    expectAssignable<string>(context.configVars["Fourth Page String"]);

    expectAssignable<TriggerPayload>(params.onTrigger.results);

    return Promise.resolve({ data: "SUCCESS" });
  },
  onInstanceDeploy: async (context) => {
    expectAssignable<Connection>(context.configVars["A Connection"]);
    expectAssignable<string>(context.configVars["A String"]);
    expectAssignable<string>(context.configVars["A Picklist"]);
    expectAssignable<JSONForm>(context.configVars["A Data Source"]);
    expectAssignable<string>(context.configVars["Fourth Page String"]);

    return Promise.resolve();
  },
  onInstanceDelete: async (context) => {
    expectAssignable<Connection>(context.configVars["A Connection"]);
    expectAssignable<string>(context.configVars["A String"]);
    expectAssignable<string>(context.configVars["A Picklist"]);
    expectAssignable<JSONForm>(context.configVars["A Data Source"]);
    expectAssignable<string>(context.configVars["Fourth Page String"]);

    return Promise.resolve();
  },
});

integration({
  name: "Config Pages",
  flows: [basicFlow],
  configPages,
});
