import { expectAssignable } from "tsd";
import { Component } from "../serverTypes";
import { integration } from "..";

export const basicDefinition = integration({
  name: "Basic Code Native Integration",
  description: "This is a basic Code Native Integration",
  category: "Basic",
  version: "0.0.1",
  labels: ["basic", "test"],
  iconPath: "icon.png",
  flows: [
    {
      name: "Flow 1",
      description: "This is a basic flow",
      trigger: {
        display: {
          label: "Trigger",
          description: "My trigger",
        },
        perform: async (context, payload, params) => {
          console.log(`Trigger context: ${JSON.stringify(context)}`);
          console.log(`Trigger payload: ${JSON.stringify(payload)}`);
          console.log(`Trigger params: ${JSON.stringify(params)}`);
          return Promise.resolve({
            payload,
          });
        },
      },
      action: {
        display: {
          label: "Action",
          description: "My action",
        },
        perform: async (context, params) => {
          console.log(`Action context: ${JSON.stringify(context)}`);
          console.log(`Action params: ${JSON.stringify(params)}`);
          return Promise.resolve({
            data: "SUCCESS",
          });
        },
      },
    },
  ],
});
expectAssignable<Component>(basicDefinition);
