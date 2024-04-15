import { expectAssignable } from "tsd";
import type {
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
