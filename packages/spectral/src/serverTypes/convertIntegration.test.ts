import { describe, expect, it } from "@jest/globals";
import { configPage, configVar, flow } from "..";
import { convertConfigPages, convertFlow } from "./convertIntegration";

describe("convertFlow with polling triggers", () => {
  const baseFlowInput = {
    name: "Test Polling Flow",
    stableKey: "test-polling-flow",
    description: "A flow with polling trigger",
    onExecution: async () => ({ data: "test" }),
  };

  it("throws error when polling trigger has no schedule", () => {
    const pollingFlowWithoutSchedule = {
      ...baseFlowInput,
      triggerType: "polling" as const,
      onTrigger: async (_context: unknown, payload: { body: { data: string } }) => {
        return { payload };
      },
    };
    // @ts-expect-error - intentionally omitting schedule to test runtime validation
    expect(() => convertFlow(pollingFlowWithoutSchedule, {}, "test-ref")).toThrow(
      "Test Polling Flow is marked as a polling trigger but has no schedule. Polling triggers require a schedule.",
    );
  });

  it("converts polling flow with schedule successfully", () => {
    const pollingFlow = flow({
      ...baseFlowInput,
      triggerType: "polling",
      schedule: { value: "*/5 * * * *" },
      onTrigger: async (_context, payload) => {
        return { payload };
      },
    });

    const result = convertFlow(pollingFlow, {}, "test-ref");

    expect(result.name).toBe("Test Polling Flow");
    expect(result.stableKey).toBe("test-polling-flow");
  });

  it("converts flow with no explicit triggerType (defaults to standard)", () => {
    const defaultFlow = flow({
      ...baseFlowInput,
      onTrigger: async (_context, payload) => {
        return { payload };
      },
    });

    const result = convertFlow(defaultFlow, {}, "test-ref");

    expect(result.name).toBe("Test Polling Flow");
  });
});

describe("convertConfigPages", () => {
  it("should handle HTML string elements correctly", () => {
    const pages = {
      Connections: configPage({
        elements: {
          Authentication: "<h1>Authentication</h1>",
        },
      }),
    };

    const result = convertConfigPages(pages, false);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Connections");
    expect(result[0].elements).toHaveLength(1);
    expect(result[0].elements[0]).toEqual({
      type: "htmlElement",
      value: "<h1>Authentication</h1>",
    });
  });

  it("should handle mixed HTML and configVar elements", () => {
    const pages = {
      TestPage: configPage({
        tagline: "Test configuration page",
        elements: {
          HeaderText: "<h2>Configuration Settings</h2>",
          ApiKey: configVar({
            stableKey: "api-key",
            dataType: "string",
            description: "Your API key",
          }),
          Instructions: "<p>Enter your details below</p>",
        },
      }),
    };

    const result = convertConfigPages(pages, false);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("TestPage");
    expect(result[0].tagline).toBe("Test configuration page");
    expect(result[0].elements).toHaveLength(3);

    // Check HTML elements
    const htmlElements = result[0].elements.filter((el) => el.type === "htmlElement");
    expect(htmlElements).toHaveLength(2);
    expect(htmlElements[0].value).toBe("<h2>Configuration Settings</h2>");
    expect(htmlElements[1].value).toBe("<p>Enter your details below</p>");

    // Check configVar element
    const configVarElements = result[0].elements.filter((el) => el.type === "configVar");
    expect(configVarElements).toHaveLength(1);
    expect(configVarElements[0].value).toBe("ApiKey");
  });

  it("should handle configVar with htmlElement dataType", () => {
    const pages = {
      TestPage: configPage({
        elements: {
          CustomHTML: {
            dataType: "htmlElement",
            stableKey: "custom-html",
          },
        },
      }),
    };

    const result = convertConfigPages(pages, false);

    expect(result).toHaveLength(1);
    expect(result[0].elements).toHaveLength(1);
    expect(result[0].elements[0]).toEqual({
      type: "htmlElement",
      value: "CustomHTML", // Uses the key as the value
    });
  });

  it("should handle empty elements object", () => {
    const pages = {
      EmptyPage: configPage({
        elements: {},
      }),
    };

    const result = convertConfigPages(pages, false);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("EmptyPage");
    expect(result[0].elements).toHaveLength(0);
  });
});
