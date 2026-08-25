import {
  type ComponentManifest,
  type ConditionalExpression,
  type Connection,
  componentManifest,
  type JSONForm,
  type ObjectFieldMap,
  type ObjectSelection,
} from "@prismatic-io/spectral";
import { expectAssignable, expectType } from "tsd";

interface DoThingValues {
  mode?: "fast" | "safe";
  data?: string;
  text?: string;
  password?: string;
  enabled?: boolean;
  code?: string;
  condition?: ConditionalExpression;
  connection: Connection;
  selection?: ObjectSelection;
  fieldMap?: ObjectFieldMap;
  form?: JSONForm;
  date?: string;
  timestamp?: string;
  flow?: string;
  template?: string;
  contact?: { firstName: string; active: boolean };
  contacts?: Array<{ email: string }>;
  record?:
    | { configuration: "person"; values: { name: string } }
    | { configuration: "company"; values: { companyName: string } };
  tags?: string[];
  headers?: Record<string, string> | Array<{ key: string; value: string }>;
}

const doThing = {
  key: "doThing",
  perform: async <TReturn>(values: DoThingValues): Promise<TReturn> => values as TReturn,
  inputs: {
    mode: { inputType: "string", default: "safe" },
    data: { inputType: "data" },
    text: { inputType: "text" },
    password: { inputType: "password" },
    enabled: { inputType: "boolean" },
    code: { inputType: "code" },
    condition: { inputType: "conditional" },
    connection: { inputType: "connection", required: true },
    selection: { inputType: "objectSelection" },
    fieldMap: { inputType: "objectFieldMap" },
    form: { inputType: "jsonForm" },
    date: { inputType: "date" },
    timestamp: { inputType: "timestamp" },
    flow: { inputType: "flow" },
    template: { inputType: "template" },
    contact: { inputType: "structuredObject" },
    contacts: { inputType: "structuredObject", collection: "valuelist", default: [] },
    record: { inputType: "dynamicObject" },
    tags: { inputType: "string", collection: "valuelist", default: [] },
    headers: { inputType: "string", collection: "keyvaluelist", default: [] },
  },
} as const;

const generatedManifest = componentManifest({
  key: "acme",
  public: true,
  signature: "signature",
  actions: { doThing },
  triggers: {},
  dataSources: {},
  connections: {},
});

expectAssignable<ComponentManifest>(generatedManifest);
expectType<DoThingValues>(null as unknown as Parameters<typeof doThing.perform>[0]);

void doThing.perform({
  connection: { key: "connection", configVarKey: "config", fields: {} },
  mode: "safe",
  data: "data",
  text: "text",
  password: "secret",
  enabled: true,
  code: "return true",
  condition: null as unknown as ConditionalExpression,
  selection: [{ object: { key: "contact" } }],
  fieldMap: { fields: [] },
  form: { schema: {}, uiSchema: { type: "VerticalLayout" } },
  date: "2026-08-27",
  timestamp: "2026-08-27T12:00:00Z",
  flow: "flow-name",
  template: "Hello, {{name}}",
  contact: { firstName: "Ada", active: true },
  contacts: [{ email: "ada@example.com" }],
  record: { configuration: "person", values: { name: "Ada" } },
  tags: ["one", "two"],
  headers: { Authorization: "Bearer token" },
});

void doThing.perform({
  connection: { key: "connection", configVarKey: "config", fields: {} },
  // @ts-expect-error generated structuredObject children retain their value types.
  contact: { firstName: 1, active: true },
});
