import {
  Inputs,
  PollingActionDefinition,
  PollingTriggerDefinition,
  action,
  pollingTrigger,
} from "@prismatic-io/spectral";
import { expectNotType, expectAssignable, expectNotAssignable } from "tsd";

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
  pollAction: {
    action: myAction,
    filterBy: (resource) => resource.id,
  },
});

const myBranchingAction = action({
  display: {
    label: "My Branching Action",
    description: "My Action Description",
  },
  inputs: {},
  allowsBranching: true,
  staticBranchNames: ["No Results", "Results"],
  perform: async () => {
    return Promise.resolve({
      branch: "No Results",
      data: [{ id: 1 }, { id: 2 }],
    });
  },
});

const myPollingTriggerWithBranchingAction = pollingTrigger({
  display: {
    label: "My Polling Trigger",
    description: "My Polling Trigger Description",
  },
  pollAction: {
    // @ts-expect-error
    action: myBranchingAction,
  },
  inputs: {},
});

expectAssignable<PollingTriggerDefinition<Inputs, any, any, any, typeof myAction>>(
  myPollingTrigger,
);

// Polling triggers cannot reference branching actions as their pollAction.
expectNotType<PollingActionDefinition>(myBranchingAction);
expectNotType<PollingTriggerDefinition<Inputs, any, any, any, PollingActionDefinition>>(
  myPollingTriggerWithBranchingAction,
);

const myDefaultPollingTrigger = pollingTrigger({
  display: {
    label: "My Default Polling Trigger",
    description: "My Default Trigger Description",
  },
  pollAction: {
    action: myAction,
    filterBy: (resource) => resource.id,
  },
});

const myCustomPollingTrigger = pollingTrigger({
  display: {
    label: "My Custom Polling Trigger",
    description: "My Custom Trigger Description",
  },
  pollAction: {
    action: myAction,
  },
  perform: async (context, payload, params) => {
    return Promise.resolve({ payload });
  },
  inputs: {},
});

// @ts-expect-error
const myInvalidTrigger = pollingTrigger({
  display: {
    label: "My Invalid Polling Trigger",
    description: "My Invalid Trigger Description",
  },
  pollAction: {
    action: myAction,
    filterBy: (object) => object.id,
  },
  perform: async (context, payload, params) => {
    return Promise.resolve({ payload });
  },
  inputs: {},
});

expectAssignable<PollingTriggerDefinition<Inputs, any, any, any, typeof myAction>>(
  myDefaultPollingTrigger,
);
expectAssignable<PollingTriggerDefinition<Inputs, any, any, any, typeof myAction>>(
  myCustomPollingTrigger,
);
expectNotAssignable<PollingActionDefinition>(myInvalidTrigger);
