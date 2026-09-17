import type { AnyServerFunction, Connection, ServerFunctionContext } from "@prismatic-io/spectral";
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
expectAssignable<keyof ServerFunctionContext>("components");
expectAssignable<keyof ServerFunctionContext>("connections");

const listRegions = serverFunction({
  inputSchema: {
    type: "object",
    properties: { cloud: { type: "string" } },
    required: ["cloud"],
    additionalProperties: false,
  },
  outputSchema: { type: "array", items: { type: "string" } },
  connections: ["cloudConnection"],
  perform: async ({ connections }, params) => {
    expectType<Connection>(connections.cloudConnection);
    // @ts-expect-error only a declared connection is in scope
    connections.undeclared;
    return [params.cloud];
  },
});

expectAssignable<AnyServerFunction>(listRegions);
