import type {
  DataSourceConfigVar,
  ConfigPages,
  ConfigVars,
  Connection,
} from "@prismatic-io/spectral";
import { ValueOf } from "@prismatic-io/spectral/dist/types/utils";
import { expectAssignable } from "tsd";

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

const createDataSourceConfigVar = (configVar: DataSourceConfigVar) => configVar;

// eslint-disable-next-line
// @ts-ignore Collection type is not supported for this data source type.
createDataSourceConfigVar({
  perform: async () => Promise.resolve({ result: "string" }),
  stableKey: "ds",
  // TODO: This causes a compile erorr when it's `jsonForm`
  // Need to figure out why that is happening. It also only happens when running
  // tsc via the cli instead of surfacing in my editor
  dataSourceType: "schedule",
  // eslint-disable-next-line
  // @ts-ignore `collectionType` is not a valid property for this data source type.
  collectionType: "valuelist",
});
