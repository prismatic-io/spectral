import { action, input } from "@prismatic-io/spectral";
import type { OutputSchema } from "@prismatic-io/spectral";

export const simpleAction = action({
  display: {
    label: "Simple Action",
    description: "An action with a structured object input and a typed output schema.",
  },
  inputs: {
    contactInfo: input({
      label: "Contact Info",
      type: "string",
      required: false,
      comments: "Contact information as a structured object.",
    }),
  },
  outputSchema: {
    type: "actionOutput",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        email: { type: "string", format: "email" },
        score: { type: "number" },
      },
      required: ["id", "name"],
    },
  } satisfies OutputSchema,
  perform: async (_context, _params) => {
    return {
      data: {
        id: "abc-123",
        name: "Test User",
        email: "test@example.com",
        score: 42,
      },
    };
  },
});

export const branchingAction = action({
  display: {
    label: "Branching Action",
    description: "An action that branches to Success or Error with typed output schemas per branch.",
  },
  allowsBranching: true,
  staticBranchNames: ["Success", "Error"],
  inputs: {
    config: input({
      label: "Config",
      type: "dynamicObjectSelection",
      required: false,
      comments: "Dynamic object selection for configuration.",
    }),
  },
  outputSchema: {
    type: "branchingOutput",
    branchSchemas: {
      Success: {
        type: "object",
        properties: {
          result: { type: "string" },
          count: { type: "integer" },
        },
      },
      Error: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  } satisfies OutputSchema,
  perform: async (_context, params) => {
    const { config } = params;
    if (config) {
      return {
        data: { result: "ok", count: 1 },
        branch: "Success",
      };
    }
    return {
      data: { code: "NO_CONFIG", message: "Config was not provided." },
      branch: "Error",
    };
  },
});

export default { simpleAction, branchingAction };
