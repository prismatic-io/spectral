import type { DataSourceDefinition, Inputs } from "../types";
import type { ComponentReference } from "./integration";

/** Declaration metadata only; never serialized into the platform component. */
export const publishedConnectionSymbol = Symbol.for(
  "@prismatic-io/spectral/publishedConnection/v1",
);
export const bundledDataSourceSymbol = Symbol.for("@prismatic-io/spectral/bundledDataSource/v1");

export interface PublishedConnection {
  component: Extract<ComponentReference["component"], { signature: string }>;
  inputs: Inputs;
}

export interface BundledDataSource {
  inputs: Inputs;
  values: Record<string, unknown>;
  detail?: DataSourceDefinition<Inputs, any, any> & {
    [bundledDataSourceSymbol]: BundledDataSource;
  };
}

export const getPublishedConnection = (value: object): PublishedConnection | undefined =>
  (value as { [publishedConnectionSymbol]?: PublishedConnection })[publishedConnectionSymbol];

export const getBundledDataSource = (value: object): BundledDataSource | undefined =>
  (value as { [bundledDataSourceSymbol]?: BundledDataSource })[bundledDataSourceSymbol];
