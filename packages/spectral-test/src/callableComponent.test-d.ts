import {
  action,
  type Connection,
  callableComponent,
  component,
  dynamicObjectInput,
  input,
  structuredObjectInput,
} from "@prismatic-io/spectral";
import { expectError, expectType } from "tsd";

const display = { label: "Example", description: "Example" };
const connection = {} as Connection;
const list = action({
  display,
  inputs: {
    connection: input({ type: "connection", label: "Connection", required: true }),
    query: input({
      type: "string",
      label: "Query",
      required: true,
      clean: (value: unknown) => ({ parsed: String(value) }),
    }),
    pageSize: input({ type: "number", label: "Size", required: true, default: "20" }),
    optional: input({ type: "string", label: "Optional" }),
  },
  perform: async () => ({ data: { total: 123 } }),
});

const authored = component({
  key: "example",
  public: false,
  display: { ...display, iconPath: "icon.png" },
  actions: { list },
});
const callable = callableComponent(authored);
expectError(callableComponent(authored, { signature: "a".repeat(40) }));
expectType<Promise<{ data: { total: number } }>>(
  callable.actions.list({ connection, query: "raw" }),
);
expectType<"list">({} as keyof typeof callable.actions);
expectError(callable.actions.list({ query: "raw" }));
expectError(callable.actions.list());
expectError(callable.actions.list({ connection, query: { parsed: "raw" } }));
expectError(callable.actions.missing({}));
expectError(callable.actions.list({ connection, query: "raw", pageSize: false }));

const nested = callableComponent({
  actions: {
    run: action({
      display,
      inputs: {
        groups: structuredObjectInput({
          label: "Groups",
          collection: "keyvaluelist",
          inputs: { value: input({ type: "string", label: "Value", required: true }) },
        }),
        choice: dynamicObjectInput({
          label: "Choice",
          required: true,
          configurations: {
            count: {
              label: "Count",
              inputs: { count: input({ type: "number", label: "Count", required: true }) },
            },
            name: {
              label: "Name",
              inputs: { name: input({ type: "string", label: "Name", required: true }) },
            },
          },
        }),
      },
      perform: async () => ({ data: true }),
    }),
    empty: action({ display, inputs: {}, perform: async () => ({ data: "ok" }) }),
    optional: action({
      display,
      inputs: { name: input({ type: "string", label: "Name" }) },
      perform: async () => ({ data: "ok" }),
    }),
  },
});
nested.actions.run({
  groups: { first: { value: "raw" } },
  choice: { configuration: "count", values: { count: 42 } },
});
nested.actions.run({
  groups: [{ key: "first", value: { value: "raw" } }],
  choice: { configuration: "name", values: { name: "name" } },
});
expectError(nested.actions.run({ choice: { configuration: "missing", values: {} } }));
expectError(nested.actions.run({ choice: { configuration: "count", values: { name: "wrong" } } }));
expectError(nested.actions.run({ choice: { configuration: "count", values: {} } }));
expectType<Promise<{ data: string }>>(nested.actions.empty());
expectType<Promise<{ data: string }>>(nested.actions.optional());

const primitive = callableComponent({
  actions: {
    run: action({
      display,
      inputs: {
        enabled: input({ type: "boolean", label: "Enabled", default: "false" }),
        data: input({ type: "data", label: "Data", default: "" }),
        selection: input({ type: "dynamicObjectSelection", label: "Selection", default: "" }),
        field: input({ type: "dynamicFieldSelection", label: "Field", default: "" }),
        cleanedData: input({
          type: "data",
          label: "Cleaned data",
          clean: (value: unknown) => value,
        }),
      },
      perform: async (_context, params) => ({ data: params.enabled }),
    }),
  },
});
expectType<Promise<{ data: string }>>(primitive.actions.run({ enabled: true }));
primitive.actions.run({
  data: "raw",
  selection: "selected",
  field: "field",
  cleanedData: { raw: true },
});
expectError(primitive.actions.run({ data: { raw: true } }));
expectError(primitive.actions.run({ selection: { raw: true } }));
expectError(primitive.actions.run({ field: { raw: true } }));
