import { action, trigger } from ".";
import { invoke, invokeTrigger } from "./testing";

const branchingAction = action({
  display: { label: "Branching", description: "Branching" },
  allowsBranching: true,
  staticBranchNames: ["Foo", "Bar"],
  inputs: {},
  perform: async () => Promise.resolve({ data: null, branch: "Foo" }),
});

const branchingTrigger = trigger({
  display: { label: "Branching", description: "Branching" },
  allowsBranching: true,
  staticBranchNames: ["Foo", "Bar"],
  scheduleSupport: "invalid",
  synchronousResponseSupport: "invalid",
  inputs: {},
  perform: async (context, payload) =>
    Promise.resolve({ payload, branch: "Foo" }),
});

describe("invoke", () => {
  it("works with branching", async () => {
    const {
      result: { branch },
    } = await invoke(branchingAction, {});
    expect(branch).toStrictEqual("Foo");
  });
});

describe("triggerInvoke", () => {
  it("works with branching", async () => {
    const {
      result: { branch },
    } = await invokeTrigger(branchingTrigger);
    expect(branch).toStrictEqual("Foo");
  });
});
