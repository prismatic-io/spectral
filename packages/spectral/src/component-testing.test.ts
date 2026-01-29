import { describe, expect, it } from "vitest";
import { action, input, pollingTrigger, trigger } from ".";
import { convertTrigger } from "./serverTypes/convertComponent";
import { createPollingPerform, PerformFn } from "./serverTypes/perform";

describe("test convert trigger", () => {
  const triggerPerform: PerformFn = async (context, payload, params) =>
    Promise.resolve({ payload });

  const myTrigger = trigger({
    display: {
      label: "My trigger",
      description: "A basic trigger",
    },
    inputs: {
      myTriggerInput: input({
        label: "My trigger input",
        type: "string",
      }),
    },
    perform: triggerPerform,
    scheduleSupport: "invalid",
    synchronousResponseSupport: "valid",
  });

  const myAction = action({
    display: {
      label: "My action",
      description: "My desc",
    },
    inputs: {
      myActionInput: {
        label: "My action input",
        type: "string",
      },
    },
    perform: async (context, params) => {
      return Promise.resolve({ data: 1 });
    },
  });

  const myPollingTrigger = pollingTrigger({
    display: {
      label: "My poll trigger",
      description: "A basic polling trigger",
    },
    pollAction: myAction,
    inputs: {
      myPollInput: {
        label: "My poll input",
        type: "string",
      },
    },
    perform: async (context, payload, params) => {
      return Promise.resolve({ payload });
    },
  });

  const myPollingTriggerWithDupeInput = pollingTrigger({
    display: {
      label: "My poll trigger",
      description: "A basic polling trigger",
    },
    pollAction: myAction,
    inputs: {
      myActionInput: {
        label: "My dupe input",
        type: "string",
      },
    },
    perform: async (context, payload, params) => {
      return Promise.resolve({ payload });
    },
  });

  const myWebhookTrigger = trigger({
    display: {
      label: "My webhook trigger",
      description: "A webhook trigger with lifecycle hooks",
    },
    inputs: {
      myWebhookInput: input({
        label: "My webhook input",
        type: "string",
      }),
    },
    perform: async (context, payload, params) => {
      return Promise.resolve({ payload });
    },
    webhookLifecycleHandlers: {
      create: async (_context, _params) => {
        return Promise.resolve({ executionState: { webhookCreated: true } });
      },
      delete: async (_context, _params) => {
        return Promise.resolve({ executionState: { webhookDeleted: true } });
      },
    },
    scheduleSupport: "invalid",
    synchronousResponseSupport: "valid",
  });

  const expectedTrigger = {
    display: { label: "My trigger", description: "A basic trigger" },
    inputs: [
      {
        key: "myTriggerInput",
        type: "string",
        default: "",
        collection: undefined,
        label: "My trigger input",
        keyLabel: undefined,
        onPremiseControlled: undefined,
      },
    ],
    scheduleSupport: "invalid",
    synchronousResponseSupport: "valid",
    key: "my-basic-trigger",
  };

  const expectedPollTrigger = {
    display: { label: "My poll trigger", description: "A basic polling trigger" },
    inputs: [
      {
        key: "myPollInput",
        type: "string",
        default: "",
        collection: undefined,
        label: "My poll input",
        keyLabel: undefined,
        onPremiseControlled: undefined,
      },
      {
        key: "myActionInput",
        type: "string",
        default: "",
        collection: undefined,
        label: "My action input",
        keyLabel: undefined,
        onPremiseControlled: undefined,
      },
    ],
    key: "my-polling-trigger",
    scheduleSupport: "required",
    synchronousResponseSupport: "invalid",
  };

  const expectedWebhookTrigger = {
    display: { label: "My webhook trigger", description: "A webhook trigger with lifecycle hooks" },
    inputs: [
      {
        key: "myWebhookInput",
        type: "string",
        default: "",
        collection: undefined,
        label: "My webhook input",
        keyLabel: undefined,
        onPremiseControlled: undefined,
      },
    ],
    key: "my-webhook-trigger",
    scheduleSupport: "invalid",
    synchronousResponseSupport: "valid",
    hasWebhookCreateFunction: true,
    hasWebhookDeleteFunction: true,
  };

  it("converts triggers properly", () => {
    const { perform, ...convertedTrigger } = convertTrigger("my-basic-trigger", myTrigger);

    expect(perform).toBeTruthy();
    expect(convertedTrigger).toMatchObject(expectedTrigger);
  });

  it("converts polling triggers properly", () => {
    const { perform, ...convertedTrigger } = convertTrigger("my-polling-trigger", myPollingTrigger);

    expect(perform).toBeTruthy();
    expect(convertedTrigger).toMatchObject(expectedPollTrigger);
  });

  it("converts webhook triggers with lifecycle hooks properly", () => {
    const convertedTrigger = convertTrigger("my-webhook-trigger", myWebhookTrigger);

    expect(convertedTrigger.perform).toBeTruthy();
    expect(convertedTrigger).toMatchObject(expectedWebhookTrigger);
  });

  it("does not allow duplicate input keys across the trigger & poll action", () => {
    const expectedMessage =
      'The pollingTrigger "My poll trigger" was defined with an input with the key: myActionInput. This key duplicates an input on the associated "My action" action. Please assign the trigger input a different key.';
    try {
      convertTrigger("my-polling-trigger", myPollingTriggerWithDupeInput);
    } catch (e) {
      if (e instanceof Error) {
        expect(e.message).toContain(expectedMessage);
      } else if (e === "string") {
        expect(e).toContain(expectedMessage);
      } else {
        throw e;
      }
    }
  });
});
