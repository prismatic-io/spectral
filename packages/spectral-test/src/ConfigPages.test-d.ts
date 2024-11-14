import {
  flow,
  integration,
  Connection,
  TriggerPayload,
  TriggerEventFunctionReturn,
  ObjectSelection,
} from "@prismatic-io/spectral";
import { expectAssignable } from "tsd";

import { configPages, componentRegistry } from "./testData.test-d";

const basicFlow = flow({
  name: "Basic Flow",
  stableKey: "basic-flow",
  description: "This is a basic flow",
  onTrigger: async (context, payload, params) => {
    expectAssignable<Connection>(context.configVars["A Connection"]);
    expectAssignable<Connection>(context.configVars["Ref Connection"]);
    expectAssignable<string>(context.configVars["A String"]);
    expectAssignable<string>(context.configVars["A Picklist"]);
    // JSON Form config var values are the resulting form values so they are
    // typed as `unknown`
    expectAssignable<unknown>(context.configVars["JSON Form Data Source"]);
    expectAssignable<unknown>(context.configVars["Ref JSON Form Data Source"]);
    expectAssignable<unknown>(context.configVars["Ref JSON Form Data Source"]);
    expectAssignable<string>(context.configVars["Ref String Data Source"]);
    expectAssignable<ObjectSelection>(context.configVars["Object Selection Data Source"]);
    expectAssignable<string>(context.configVars["Fourth Page String"]);

    expectAssignable<Record<string, unknown>>(params);

    return Promise.resolve({ payload });
  },
  onExecution: async (context, params) => {
    expectAssignable<Connection>(context.configVars["A Connection"]);
    expectAssignable<Connection>(context.configVars["Ref Connection"]);
    expectAssignable<string>(context.configVars["A String"]);
    expectAssignable<string>(context.configVars["A Picklist"]);
    expectAssignable<unknown>(context.configVars["JSON Form Data Source"]);
    expectAssignable<unknown>(context.configVars["Ref JSON Form Data Source"]);
    expectAssignable<string>(context.configVars["Ref String Data Source"]);
    expectAssignable<ObjectSelection>(context.configVars["Object Selection Data Source"]);
    expectAssignable<string>(context.configVars["Fourth Page String"]);

    expectAssignable<TriggerPayload>(params.onTrigger.results);

    return Promise.resolve({ data: "SUCCESS" });
  },
  onInstanceDeploy: async (context) => {
    expectAssignable<Connection>(context.configVars["A Connection"]);
    expectAssignable<Connection>(context.configVars["Ref Connection"]);
    expectAssignable<string>(context.configVars["A String"]);
    expectAssignable<string>(context.configVars["A Picklist"]);
    expectAssignable<unknown>(context.configVars["JSON Form Data Source"]);
    expectAssignable<unknown>(context.configVars["Ref JSON Form Data Source"]);
    expectAssignable<string>(context.configVars["Ref String Data Source"]);
    expectAssignable<ObjectSelection>(context.configVars["Object Selection Data Source"]);
    expectAssignable<string>(context.configVars["Fourth Page String"]);

    return Promise.resolve<TriggerEventFunctionReturn>({});
  },
  onInstanceDelete: async (context) => {
    expectAssignable<Connection>(context.configVars["A Connection"]);
    expectAssignable<Connection>(context.configVars["Ref Connection"]);
    expectAssignable<string>(context.configVars["A String"]);
    expectAssignable<string>(context.configVars["A Picklist"]);
    expectAssignable<unknown>(context.configVars["JSON Form Data Source"]);
    expectAssignable<unknown>(context.configVars["Ref JSON Form Data Source"]);
    expectAssignable<string>(context.configVars["Ref String Data Source"]);
    expectAssignable<ObjectSelection>(context.configVars["Object Selection Data Source"]);
    expectAssignable<string>(context.configVars["Fourth Page String"]);

    return Promise.resolve<TriggerEventFunctionReturn>({});
  },
});

const triggerFlow = flow({
  name: "Trigger Flow",
  stableKey: "trigger-flow",
  description: "This is a trigger flow",
  onTrigger: {
    component: "http",
    key: "hmac",
    signature: "http-signature",
    isPublic: true,
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
  stableKey: "config-pages-integration",
  name: "Config Pages",
  flows: [basicFlow, triggerFlow],
  configPages,
  componentRegistry,
});
