import {
  action,
  type ActionContext,
  type Connection,
  component,
  dynamicObjectInput,
  input,
  structuredObjectInput,
} from "@prismatic-io/spectral";
import type { Action, Component } from "@prismatic-io/spectral/dist/serverTypes";
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

// component(definition) makes each action directly callable, and the result is still the
// component the platform publishes and runs.
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

// The result is the erased server Component too, so loaders, publishers and
// hand-written test utilities that annotate with it keep compiling; its actions
// are erased `Action`s; and a runtime string key still resolves.
expectAssignable<Component>(callable);
expectAssignable<Action>(callable.actions.echo);
expectAssignable<Action>(callable.actions["echo" as string]);
expectAssignable<Action[]>(Object.values(callable.actions));
expectAssignable<(context: ActionContext, params: Record<string, unknown>) => Promise<unknown>>(
  callable.actions.echo.perform,
);

// Optional-ness applies recursively through structuredObject children and
// dynamicObject configuration values.
const nested = component(
  {
    key: "nested-definition",
    display: { label: "Nested", description: "Nested", iconPath: "icon.png" },
    actions: {
      list: action({
        display: { label: "List", description: "List" },
        inputs: {
          pagination: structuredObjectInput({
            label: "Pagination",
            required: false,
            inputs: {
              pageSize: input({ label: "Page Size", type: "string", default: "10" }),
              pageToken: input({ label: "Page Token", type: "string", required: false }),
              cursor: input({ label: "Cursor", type: "string", required: true }),
            },
          }),
          target: dynamicObjectInput({
            label: "Target",
            configurations: {
              email: {
                label: "Email",
                inputs: {
                  address: input({ label: "Address", type: "string", required: true }),
                  subject: input({ label: "Subject", type: "string", default: "Hello" }),
                },
              },
            },
          }),
        },
        perform: async (_context, { pagination, target }) => ({ data: { pagination, target } }),
      }),
    },
  },
);

nested.actions.list({ target: { configuration: "email", values: { address: "a@b.c" } } });
nested.actions.list({
  pagination: { cursor: "c" },
  target: { configuration: "email", values: { address: "a@b.c" } },
});
nested.actions.list({
  pagination: { cursor: "c", pageSize: "5", pageToken: "t" },
  target: { configuration: "email", values: { address: "a@b.c", subject: "Hi" } },
});
// A required child is still required.
expectError(
  nested.actions.list({
    pagination: {},
    target: { configuration: "email", values: { address: "a@b.c" } },
  }),
);
expectError(nested.actions.list({ target: { configuration: "email", values: {} } }));
