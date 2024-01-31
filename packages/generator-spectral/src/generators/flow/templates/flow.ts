import { flow } from "@prismatic-io/spectral";
import { createClient } from "./client";
import type { ConfigPages } from "./configPages";

export const <%= flow.key %> = flow<ConfigPages>({
  name: "<%= flow.name %>",
  stableKey: "<%= flow.stableKey %>",
  description: "<%= flow.description %>",
  onTrigger: async (context, payload, params) => {
    const { logger } = context;

    logger.info(`Trigger context: ${JSON.stringify(context)}`);
    logger.info(`Trigger payload: ${JSON.stringify(payload)}`);
    logger.info(`Trigger params: ${JSON.stringify(params)}`);

    return Promise.resolve({
      payload,
    });
  },
  onExecution: async (context, params) => {
    const { logger, configVars } = context;

    if (!configVars?.connection1) {
      throw new Error("Missing connection1 configuration");
    }

    logger.info(`Action context: ${JSON.stringify(context)}`);
    logger.info(`Action params: ${JSON.stringify(params)}`);

    const client = createClient(configVars.connection1);
    return {
      data: await client.call("<%= flow.name %>"),
    };
  },
});

export default [<%= flow.key %>];
