import { action, type Connection, component, input } from "@prismatic-io/spectral";
import type { Component } from "@prismatic-io/spectral/dist/serverTypes";
import { expectAssignable, expectError, expectType } from "tsd";

const privateDefinition = component({
  key: "private-definition",
  display: { label: "Private", description: "Private", iconPath: "icon.png" },
});
expectAssignable<Component>(privateDefinition);

const publicDefinition = component({
  key: "public-definition",
  public: true,
  display: {
    label: "Public",
    description: "Public",
    iconPath: "icon.png",
    category: "Application Connectors",
  },
  documentationUrl: "https://prismatic.io/docs/components/public-definition/",
});
expectAssignable<Component>(publicDefinition);

// component(definition, { callable: true }) makes each action directly callable.
const callable = component(
  {
    key: "callable-definition",
    display: { label: "Callable", description: "Callable", iconPath: "icon.png" },
    actions: {
      echo: action({
        display: { label: "Echo", description: "Echo" },
        inputs: {
          connection: input({ label: "Connection", type: "connection", required: true }),
          greeting: input({ label: "Greeting", type: "string", required: true, default: "Hi" }),
          name: input({ label: "Name", type: "string", required: false }),
          shout: input({ label: "Shout", type: "boolean", clean: (value) => Boolean(value) }),
        },
        perform: async (_context, { greeting, name, shout }) => ({
          data: { message: `${greeting} ${name ?? "there"}`, shout },
        }),
      }),
    },
  },
  { callable: true },
);

// Only inputs that are `required: true` without a default must be supplied.
expectType<Promise<{ data: { message: string; shout: boolean } }>>(
  callable.actions.echo({ connection: {} as Connection }),
);
expectType<Promise<{ data: { message: string; shout: boolean } }>>(
  callable.actions.echo({ connection: {} as Connection, greeting: "Yo", name: "Pat", shout: true }),
);
expectError(callable.actions.echo({}));
expectError(callable.actions.echo({ connection: {} as Connection, shout: "yes" }));

// The legacy (context, params) perform is still there for the runner.
expectAssignable<(context: never, params: never) => Promise<unknown>>(
  callable.actions.echo.perform,
);

// Without the option the action stays a plain object, not a function.
const plain = component({
  key: "plain-definition",
  display: { label: "Plain", description: "Plain", iconPath: "icon.png" },
  actions: {
    echo: action({
      display: { label: "Echo", description: "Echo" },
      inputs: { name: input({ label: "Name", type: "string" }) },
      perform: async (_context, { name }) => ({ data: name }),
    }),
  },
});
expectError(plain.actions.echo({ name: "Pat" }));
