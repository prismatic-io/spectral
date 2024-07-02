import type {
  DataSourceConfigVar,
  ConfigPages,
  ConfigVars,
  Connection,
} from "@prismatic-io/spectral";
import { ValueOf } from "@prismatic-io/spectral/dist/types/utils";
import { expectAssignable, expectError } from "tsd";

type RawConnectionElems = ValueOf<ConfigPages>["elements"];
expectAssignable<"A Connection" | "Ref Connection">(
  null as unknown as keyof RawConnectionElems
);

type ConnectionElems = ValueOf<ConfigPages>["elements"];
expectAssignable<"A Connection" | "Ref Connection">(
  null as unknown as keyof ConnectionElems
);

expectAssignable<Connection>(null as unknown as ConfigVars["A Connection"]);
expectAssignable<Connection>(null as unknown as ConfigVars["Ref Connection"]);

// Subset of data source types support collections.
expectAssignable<DataSourceConfigVar>({
  perform: async () => Promise.resolve({ result: "string" }),
  stableKey: "ds",
  dataSourceType: "picklist",
  collectionType: "valuelist",
});

// Distinct subset of data source types does not support collections.
expectError<DataSourceConfigVar>({
  perform: async () => Promise.resolve({ result: "string" }),
  stableKey: "ds",
  dataSourceType: "jsonForm",
  collectionType: "valuelist",
});
