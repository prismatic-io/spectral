import { flow, Connection } from "@prismatic-io/spectral";
import { createClient } from "./client";

export const <%= flow.key %> = flow({
  name: "<%= flow.name %>",
  description: "<%= flow.description %>",
  trigger: {
    display: {
      label: "<%= flow.name %> Trigger",
      description: "Trigger for <%= flow.name %>",
    },
    perform: async (context, payload, params) => {
      const { logger } = context;

      logger.info(`Trigger context: ${JSON.stringify(context)}`);
      logger.info(`Trigger payload: ${JSON.stringify(payload)}`);
      logger.info(`Trigger params: ${JSON.stringify(params)}`);

      return Promise.resolve({
        payload,
      });
    },
  },
  action: {
    display: {
      label: "<%= flow.name %> Action",
      description: "Action for <%= flow.name %>",
    },
    perform: async (context, params) => {
      const { logger, configVars } = context;

      if (!configVars?.connection1) {
        throw new Error("Missing connection1 configuration");
      }

      logger.info(`Action context: ${JSON.stringify(context)}`);
      logger.info(`Action params: ${JSON.stringify(params)}`);

      const client = createClient(configVars.connection1 as Connection);
      return {
        data: await client.call("<%= flow.name %>"),
      };
    },
  }
});

export default [<%= flow.key %>];
