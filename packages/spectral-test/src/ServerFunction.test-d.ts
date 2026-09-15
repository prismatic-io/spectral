import type { AnyServerFunction, ServerFunctionContext } from "@prismatic-io/spectral";
import { serverFunction } from "@prismatic-io/spectral";
import { expectAssignable, expectNotAssignable, expectType } from "tsd";

const searchChannels = serverFunction({
  inputSchema: {
    type: "object",
    properties: { search: { type: "string" } },
    required: ["search"],
    additionalProperties: false,
  },
  outputSchema: { type: "array", items: { type: "string" } },
  perform: async (_context, params) => {
    expectType<string>(params.search);
    return [params.search];
  },
});

expectAssignable<AnyServerFunction>(searchChannels);

expectNotAssignable<keyof ServerFunctionContext>("configuration");
expectAssignable<keyof ServerFunctionContext>("connections");
