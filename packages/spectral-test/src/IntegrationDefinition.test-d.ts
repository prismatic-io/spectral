import {
  integration,
  FlowExecutionContext,
  FlowExecutionContextActions,
} from "@prismatic-io/spectral";
import { Component } from "@prismatic-io/spectral/dist/serverTypes";
import { expectAssignable } from "tsd";

const basicDefinition = integration({
  name: "Basic Code Native Integration",
  description: "This is a basic Code Native Integration",
  category: "Basic",
  version: "0.0.1",
  labels: ["basic", "test"],
  iconPath: "icon.png",
  flows: [
    {
      name: "Flow 1",
      stableKey: "flow1",
      description: "This is a basic flow",
      onTrigger: async (context, payload, params) => {
        console.log(`Trigger context: ${JSON.stringify(context)}`);
        console.log(`Trigger payload: ${JSON.stringify(payload)}`);
        console.log(`Trigger params: ${JSON.stringify(params)}`);
        return Promise.resolve({
          payload,
        });
      },
      onExecution: async (context, params) => {
        expectAssignable<(inputs: { connection: string; channel: string }) => Promise<any>>(
          context.components.slack.postMessage,
        );
        console.log(`Action context: ${JSON.stringify(context)}`);
        console.log(`Action params: ${JSON.stringify(params)}`);
        return Promise.resolve({
          data: "SUCCESS",
        });
      },
    },
  ],
});
expectAssignable<Component>(basicDefinition);
expectAssignable<Parameters<FlowExecutionContext["components"]["slack"]["postMessage"]>[0]>({
  connection: "testConnection",
  channel: "testChannel",
});
expectAssignable<Parameters<FlowExecutionContextActions["slack"]["postMessage"]>[0]>({
  connection: "testConnection",
  channel: "testChannel",
});

const withPollingTriggerDefinition = integration({
  name: "Polling Integration",
  description: "Integration with polling trigger",
  category: "Basic",
  version: "0.0.1",
  iconPath: "icon.png",
  flows: [
    {
      name: "Polling Flow",
      stableKey: "pollingFlow",
      description: "A flow with a polling trigger",
      triggerType: "polling",
      schedule: { value: "*/5 * * * *" }, // Required for polling triggers
      onTrigger: async (context, payload, params) => {
        // Test polling context methods are available
        const state = context.polling.getState();
        context.polling.setState({ lastPoll: new Date().toISOString() });

        return Promise.resolve({
          payload,
        });
      },
      onExecution: async (context, params) => {
        return Promise.resolve({
          data: "SUCCESS",
        });
      },
    },
  ],
});
expectAssignable<Component>(withPollingTriggerDefinition);
