import type { AnyServerFunction, Connection, ServerFunctionContext } from "@prismatic-io/spectral";
import { serverFunction } from "@prismatic-io/spectral";
import { expectAssignable, expectType } from "tsd";

const searchChannels = serverFunction({
  inputSchema: {
    type: "object",
    properties: { search: { type: "string" } },
    required: ["search"],
    additionalProperties: false,
  },
  outputSchema: { type: "array", items: { type: "string" } },
  perform: async (context, params) => {
    expectType<string>(params.search);
    expectType<unknown>(context.configuration);
    expectType<unknown>(context.userConfiguration);
    return [params.search];
  },
});

expectAssignable<AnyServerFunction>(searchChannels);

expectAssignable<keyof ServerFunctionContext>("configuration");
expectAssignable<keyof ServerFunctionContext>("userConfiguration");
expectAssignable<keyof ServerFunctionContext>("user");
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
  connections: ["instance.cloudConnection", "userLevel.cloudConnection"],
  perform: async ({ connections }, params) => {
    expectType<Connection>(connections.instance.cloudConnection);
    expectType<Connection>(connections.userLevel.cloudConnection);
    // @ts-expect-error only a declared connection is in scope
    connections.instance.undeclared;
    // @ts-expect-error qualified dependencies are reconstructed as nested connections
    connections.cloudConnection;
    return [params.cloud];
  },
});

expectAssignable<AnyServerFunction>(listRegions);
