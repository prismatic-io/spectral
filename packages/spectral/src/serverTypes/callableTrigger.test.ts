import { describe, expect, it } from "vitest";
import { component, input, trigger } from "..";
import { isNpmTriggerReference } from "../types";

const npmComponent = component(
  {
    key: "acme-npm",
    public: true,
    display: { label: "Acme", description: "An npm-published component" },
    documentationUrl: "https://prismatic.io/docs/components/acme-npm/",
    triggers: {
      webhook: trigger({
        display: { label: "Webhook", description: "Fires on an inbound webhook" },
        inputs: { greeting: input({ type: "string", label: "Greeting", default: "hi" }) },
        scheduleSupport: "invalid",
        synchronousResponseSupport: "valid",
        perform: async (_context, payload) => ({ payload }),
      }),
    },
  },
  { callable: true },
);

describe("createCallableTrigger (via component(..., { callable: true }))", () => {
  it("returns a function, not the plain trigger object", () => {
    expect(typeof npmComponent.triggers.webhook).toBe("function");
  });

  it("tags its return value so isNpmTriggerReference recognizes it", () => {
    const ref = npmComponent.triggers.webhook({ greeting: { value: "hey" } });
    expect(isNpmTriggerReference(ref)).toBe(true);
  });

  it("carries the referenced trigger's own converted definition", () => {
    const ref = npmComponent.triggers.webhook({});
    expect(ref.trigger.key).toBe("webhook");
    expect(typeof ref.trigger.perform).toBe("function");
  });

  it("defaults to an empty values object when called with no arguments", () => {
    const ref = npmComponent.triggers.webhook();
    expect(ref.values).toEqual({});
  });

  it("does not fill in defaults itself — values stay exactly as authored", () => {
    // Unlike an action's `fillDefaults`, a trigger reference's values are
    // ValueExpression/ConfigVarExpression/TemplateExpression, not resolved
    // input values — default-filling happens later, at convert time.
    const ref = npmComponent.triggers.webhook({ greeting: { configVar: "Org Greeting" } });
    expect(ref.values).toEqual({ greeting: { configVar: "Org Greeting" } });
  });
});

describe("isNpmTriggerReference", () => {
  it("rejects a manifest-style ComponentReference", () => {
    expect(isNpmTriggerReference({ component: "slack", key: "webhook", values: {} })).toBe(false);
  });

  it("rejects plain objects and null", () => {
    expect(isNpmTriggerReference({})).toBe(false);
    expect(isNpmTriggerReference(null)).toBe(false);
    expect(isNpmTriggerReference(undefined)).toBe(false);
  });
});
