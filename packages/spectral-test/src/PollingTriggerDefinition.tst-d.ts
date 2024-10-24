import {
  Inputs,
  PollingActionDefinition,
  PollingTriggerDefinition,
  PollingTriggerPayload,
  PollingTriggerResult,
  action,
  pollingTrigger,
} from "@prismatic-io/spectral";
import { expectNotType, expectAssignable } from "tsd";

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
  filterBy: (resource) => resource.id,
  pollAction: {
    action: myAction,
  },
  inputs: {},
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

type ValidPollingActionDefinition = PollingActionDefinition<any, any, any>;
type ValidPollingTriggerDefinition = PollingTriggerDefinition<
  Inputs,
  any,
  any,
  PollingTriggerResult<PollingTriggerPayload>,
  ValidPollingActionDefinition
>;

expectAssignable<ValidPollingTriggerDefinition>(myPollingTrigger);

// Polling triggers cannot reference branching actions as their pollAction.
expectNotType<ValidPollingActionDefinition>(myBranchingAction);
expectNotType<ValidPollingTriggerDefinition>(myPollingTriggerWithBranchingAction);
