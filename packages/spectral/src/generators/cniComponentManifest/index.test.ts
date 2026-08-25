import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("axios", () => ({
  default: { post: mocks.post },
  AxiosError: class AxiosError extends Error {},
}));

vi.mock("../utils/prism", () => ({
  getPrismAccessToken: vi.fn().mockResolvedValue("token"),
}));

import { fetchComponentDataForManifest, parseInputModel, transformInputNodes } from ".";

describe("parseInputModel", () => {
  it("decodes the double-encoded GraphQL scalar", () => {
    const choices = [{ label: "Example", value: "example" }];

    expect(parseInputModel(JSON.stringify(JSON.stringify(choices)))).toEqual(choices);
  });

  it.each([
    undefined,
    null,
    "not JSON",
    JSON.stringify([{ label: "Example", value: "example" }]),
    JSON.stringify(JSON.stringify([{ label: "Missing value" }])),
  ])("rejects an unusable model (%s)", (model) => {
    expect(parseInputModel(model)).toBeUndefined();
  });
});

describe("transformInputNodes", () => {
  it("canonicalizes container types and preserves their nested input shape", () => {
    const [input] = transformInputNodes([
      {
        id: "contact-id",
        parentId: null,
        key: "contact",
        label: "Contact",
        type: "STRUCTUREDOBJECT",
        required: false,
        default: null,
        collection: "VALUELIST",
        shown: true,
        onPremiseControlled: false,
      },
      {
        id: "first-name-id",
        parentId: "contact-id",
        key: "firstName",
        label: "First name",
        type: "STRING",
        required: true,
        default: null,
        collection: "",
        shown: true,
        onPremiseControlled: false,
      },
    ]);

    expect(input).toMatchObject({
      type: "structuredObject",
      collection: "valuelist",
      inputs: [{ key: "firstName", type: "string" }],
    });
  });
});

describe("fetchComponentDataForManifest", () => {
  it("requests and transforms nested fields used by the manifest generator", async () => {
    mocks.post
      .mockResolvedValueOnce({
        data: {
          data: {
            components: {
              nodes: [
                {
                  id: "component-id",
                  key: "acme",
                  label: "Acme",
                  description: "Acme component",
                  signature: "signature",
                  connections: { nodes: [] },
                },
              ],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            actions: {
              nodes: [
                {
                  isTrigger: false,
                  isDataSource: false,
                  key: "doThing",
                  label: "Do Thing",
                  description: "Does a thing",
                  inputs: {
                    nodes: [
                      {
                        id: "contact-id",
                        parentId: null,
                        key: "contact",
                        label: "Contact",
                        type: "STRUCTUREDOBJECT",
                        required: false,
                        default: null,
                        collection: null,
                        shown: true,
                        onPremiseControlled: false,
                      },
                      {
                        id: "name-id",
                        parentId: "contact-id",
                        key: "name",
                        label: "Name",
                        type: "STRING",
                        required: true,
                        default: null,
                        collection: null,
                        shown: true,
                        onPremiseControlled: false,
                        model: JSON.stringify(
                          JSON.stringify([{ label: "Example", value: "example" }]),
                        ),
                      },
                    ],
                  },
                },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      });

    const component = await fetchComponentDataForManifest({
      componentKey: "acme",
      isPrivate: false,
    });

    expect(component.actions.doThing.inputs).toMatchObject([
      {
        type: "structuredObject",
        inputs: [{ type: "string", model: [{ label: "Example", value: "example" }] }],
      },
    ]);

    for (const [, request] of mocks.post.mock.calls) {
      const query = request.query as string;
      expect(query).toContain("...ManifestInputField");
      expect(query).toContain("fragment ManifestInputField on InputField");
      expect(query).toContain("parentId");
      expect(query).toMatch(/\n\s+model\n/);
      expect(query).not.toContain("model {");
    }
  });
});
