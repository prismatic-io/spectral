import { PollingTriggerDefinition, action, pollingTrigger } from "@prismatic-io/spectral";
import { expectAssignable, expectNotType } from "tsd";

const myAction = action({
  display: {
    label: "My Action",
    description: "My Action Description",
  },
  inputs: {},
  perform: async () => {
    return Promise.resolve({ data: [{ id: 1 }, { id: 2 }] });
  },
});

const myPollingTrigger = pollingTrigger({
  display: {
    label: "My Polling Trigger",
    description: "My Polling Trigger Description",
  },
  pollAction: myAction,
  perform: async (context, payload, params) => {
    return Promise.resolve({ payload, polledNoChanges: true });
  },
});

const pollingTriggerWithoutAction = pollingTrigger({
  display: {
    label: "My Polling Trigger",
    description: "My Polling Trigger Description",
  },
  perform: async (context, payload, params) => {
    return Promise.resolve({ payload, polledNoChanges: true });
  },
});

expectAssignable<PollingTriggerDefinition>(myPollingTrigger);
expectAssignable<PollingTriggerDefinition>(pollingTriggerWithoutAction);

// @ts-expect-error: Polling triggers require a perform
const invalidPollingTrigger = pollingTrigger({
  display: {
    label: "My Polling Trigger",
    description: "My Polling Trigger Description",
  },
  pollAction: myAction,
});

expectNotType<PollingTriggerDefinition>(invalidPollingTrigger);
