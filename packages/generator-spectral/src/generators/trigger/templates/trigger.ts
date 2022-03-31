import { trigger } from "@prismatic-io/spectral";

export const <%= trigger.key %> = trigger({
  display: {
    label: "<%= trigger.label %>",
    description: "<%= trigger.description %>",
  },
  perform: async (context, payload, params) => {
    return {
      payload,
    };
  },
  inputs: {},
  synchronousResponseSupport: "valid",
  scheduleSupport: "valid",
});

export default { <%= trigger.key %> };
