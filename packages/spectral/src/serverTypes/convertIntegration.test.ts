import { describe, expect, it } from "@jest/globals";
import { configPage, configVar } from "..";
import { convertConfigPages } from "./convertIntegration";

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
