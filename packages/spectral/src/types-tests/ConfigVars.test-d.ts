import { expectAssignable, expectError } from "tsd";
import type {
  DataSourceConfigVar,
  ExtractConfigVars,
  GetElements,
} from "../types/IntegrationDefinition";
import {
  Connection,
  OAuth2Type,
  configPage,
  connectionConfigVar,
  input,
  reference,
} from "..";
import { ValueOf } from "../types/utils";

type NeverConfigVars = ExtractConfigVars<never>;
expectAssignable<never>(null as NeverConfigVars);

interface ExampleConnection {
  type: "connection";
  component: "example";
  key: "example-connection";
  values: { foo: string };
}
type Components = ExampleConnection;

const configPages = {
  "First Page": configPage({
    elements: {
      "A Connection": connectionConfigVar({
        stableKey: "a-connection",
        oauth2Type: OAuth2Type.AuthorizationCode,
        inputs: {
          authorizeUrl: input({
            label: "Authorize URL",
            type: "string",
          }),
          // more inputs
        },
      }),
      "Ref Connection": reference<Components>().connection({
        stableKey: "ref-connection",
        connection: {
          component: "example",
          key: "example-connection",
          values: { foo: { value: "bar" } },
        },
      }),
    },
  }),
};
type ConfigPages = typeof configPages;

type RawConnectionElems = ValueOf<ConfigPages>["elements"];
expectAssignable<"A Connection" | "Ref Connection">(
  null as unknown as keyof RawConnectionElems
);

type ConnectionElems = GetElements<ConfigPages>;
expectAssignable<"A Connection" | "Ref Connection">(
  null as unknown as keyof ConnectionElems
);

type ConnectionVars = ExtractConfigVars<ConfigPages>;
expectAssignable<Connection>(null as unknown as ConnectionVars["A Connection"]);
expectAssignable<Connection>(
  null as unknown as ConnectionVars["Ref Connection"]
);

// Subset of data source types support collections.
expectAssignable<DataSourceConfigVar<any>>({
  perform: async () => Promise.resolve({ result: "string" }),
  stableKey: "ds",
  dataSourceType: "picklist",
  collectionType: "valuelist",
});

// Distinct subset of data source types does not support collections.
expectError<DataSourceConfigVar<any>>({
  perform: async () => Promise.resolve({ result: "string" }),
  stableKey: "ds",
  dataSourceType: "jsonForm",
  collectionType: "valuelist",
});
