import { action, trigger, connection, dataSource } from ".";
import {
  invoke,
  invokeTrigger,
  invokeDataSource,
  createConnection,
} from "./testing";

const myConnection = connection({
  key: "myConnection",
  label: "My Connection",
  comments: "This is my connection",
  inputs: {
    username: {
      label: "Username",
      placeholder: "Username",
      type: "string",
      required: true,
      comments: "Username for my Connection",
    },
    password: {
      label: "Password",
      placeholder: "Password",
      type: "password",
      required: true,
      comments: "Password for my Connection",
    },
  },
});

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

const basicDataSource = dataSource({
  display: { label: "Basic Data Source", description: "Basic Data Source" },
  inputs: {},
  perform: async () => Promise.resolve({ content: "Hello" }),
});

describe("createConnection", () => {
  it("works with connection types", () => {
    const conn = createConnection(myConnection, {
      username: "hello",
      password: "world",
    });
    expect(conn).toBeDefined();
  });
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

describe("dataSourceInvoke", () => {
  it("basic example works", async () => {
    const {
      result: { content },
    } = await invokeDataSource(basicDataSource, {});
    expect(content).toStrictEqual("Hello");
  });
});
