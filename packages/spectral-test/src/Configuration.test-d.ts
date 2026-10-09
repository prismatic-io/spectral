import type { Connection } from "@prismatic-io/spectral";
import {
  configuration,
  organizationActivatedConnection,
  serverFunction,
  userActivatedConnection,
} from "@prismatic-io/spectral";
import { expectError, expectType } from "tsd";

const schema = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
  additionalProperties: false,
} as const;

const instance = {
  schema,
  version: "v1",
  connections: {
    shared: organizationActivatedConnection({ stableKey: "shared-api" }),
    instanceOnly: organizationActivatedConnection({ stableKey: "instance-only" }),
  },
} as const;

const userLevel = {
  schema,
  version: "v1",
  connections: {
    shared: userActivatedConnection({ stableKey: "personal-api" }),
    userOnly: userActivatedConnection({ stableKey: "user-only" }),
  },
} as const;

const sharedFunction = serverFunction({
  inputSchema: schema,
  outputSchema: schema,
  connections: ["instance.shared", "userLevel.shared"],
  perform: async (context, params) => {
    expectType<Connection>(context.connections.instance.shared);
    expectType<Connection>(context.connections.userLevel.shared);
    return params;
  },
});

const definition = configuration({
  instance,
  userLevel,
  serverFunctions: { sharedFunction },
  init: {
    connections: ["instance.shared", "userLevel.shared"],
    perform: async (context) => {
      expectType<Connection>(context.connections.instance.shared);
      expectType<Connection>(context.connections.userLevel.shared);
      // @ts-expect-error undeclared initializer dependency
      context.connections.instance.instanceOnly;
      // @ts-expect-error undeclared initializer dependency
      context.connections.userLevel.userOnly;

      // @ts-expect-error init has no scope discriminator
      context.scope;
      if (context.configurationVersion === "v1") {
        expectType<{ readonly name: string }>(context.configuration);
        expectType<unknown>(context.userConfiguration);
      }
      return { initialized: true };
    },
  },
});

expectType<"v1">(definition.instance.version);
expectType<"v1">(definition.userLevel.version);
expectType<typeof instance.connections>(definition.instance.connections);
expectType<typeof userLevel.connections>(definition.userLevel.connections);

expectError(
  configuration({
    instance,
    userLevel,
    init: {
      connections: ["userLevel.instanceOnly"],
      perform: async () => ({}),
    },
  }),
);

expectError(
  configuration({
    instance,
    userLevel,
    init: {
      connections: ["instance.userOnly"],
      perform: async () => ({}),
    },
  }),
);

expectError(
  configuration({
    instance,
    init: {
      connections: ["userLevel.shared"],
      perform: async () => ({}),
    },
  }),
);

expectError(
  configuration({
    instance,
    serverFunctions: { sharedFunction },
  }),
);

const wrongScopeFunction = serverFunction({
  inputSchema: schema,
  outputSchema: schema,
  connections: ["userLevel.instanceOnly"],
  perform: async (_context, params) => params,
});

expectError(
  configuration({
    instance,
    userLevel,
    serverFunctions: { wrongScopeFunction },
  }),
);

expectError(
  configuration({
    instance: {
      schema,
      version: "v1",
      connections: {
        personal: userActivatedConnection({ stableKey: "personal-api" }),
      },
    },
  }),
);

expectError(
  configuration({
    instance,
    userLevel: {
      schema,
      version: "v1",
      connections: {
        shared: organizationActivatedConnection({ stableKey: "shared-api" }),
      },
    },
  }),
);

configuration({
  instance: { schema, version: "v1" },
  init: {
    perform: async (context) => {
      // @ts-expect-error no initializer dependencies were declared
      context.connections.instance.shared;
      return {};
    },
  },
});

configuration({
  instance: { schema, version: "v1", ui: { type: "uiSchema", value: { type: "Control" } } },
  userLevel: { schema, version: "v1", ui: { type: "custom", value: ["custom", 1] } },
});

expectError(
  configuration({
    instance: { schema, version: "v1", ui: { type: "unknown", value: {} } },
  }),
);

expectError(
  configuration({
    instance: { schema, version: "v1", ui: { type: "uiSchema" } },
  }),
);
