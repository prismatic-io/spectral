import type { Connection } from "@prismatic-io/spectral";
import {
  configuration,
  organizationActivatedConnection,
  serverFunction,
  userActivatedConnection,
} from "@prismatic-io/spectral";
import { expectError, expectType } from "tsd";
import { z } from "zod";

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
      return {
        configuration: { name: "" },
        userConfiguration: { name: "" },
        initialized: true,
      };
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
      perform: async () => ({ configuration: { name: "" }, userConfiguration: { name: "" } }),
    },
  }),
);

expectError(
  configuration({
    instance,
    userLevel,
    init: {
      connections: ["instance.userOnly"],
      perform: async () => ({ configuration: { name: "" }, userConfiguration: { name: "" } }),
    },
  }),
);

expectError(
  configuration({
    instance,
    init: {
      connections: ["userLevel.shared"],
      perform: async () => ({ configuration: { name: "" } }),
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
      return { configuration: { name: "" } };
    },
  },
});

expectError(
  configuration({
    instance,
    init: { perform: async () => ({ initialized: true }) },
  }),
);

expectError(
  configuration({
    instance,
    init: { perform: async () => ({ configuration: { name: 42 } }) },
  }),
);

expectError(
  configuration({
    instance,
    userLevel,
    init: { perform: async () => ({ configuration: { name: "" } }) },
  }),
);

expectError(
  configuration({
    instance,
    userLevel,
    init: {
      perform: async () => ({
        configuration: { name: "" },
        userConfiguration: { name: false },
      }),
    },
  }),
);

const zodInstance = { schema: z.object({ count: z.number() }), version: "v1" };
const zodUser = { schema: z.object({ locale: z.string() }), version: "user-v1" };
const zodDefinition = configuration({
  instance: zodInstance,
  userLevel: zodUser,
  init: {
    perform: async () => ({
      configuration: { count: 0 },
      userConfiguration: { locale: "" },
      choices: ["en"],
    }),
  },
});
type ZodInitResult = Awaited<ReturnType<NonNullable<typeof zodDefinition.init>["perform"]>>;
expectType<{
  configuration: { count: number };
  userConfiguration: { locale: string };
  choices: string[];
}>({} as ZodInitResult);

expectError(
  configuration({
    instance: zodInstance,
    init: { perform: async () => ({ configuration: { count: "wrong" } }) },
  }),
);

expectError(
  configuration({
    instance: zodInstance,
    userLevel: zodUser,
    init: {
      perform: async () => ({
        configuration: { count: 0 },
        userConfiguration: { locale: 42 },
      }),
    },
  }),
);

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
