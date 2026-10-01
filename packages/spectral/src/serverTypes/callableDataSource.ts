import type {
  BaseConfigVar,
  ComponentReference,
  DataSourceReset,
  NpmDataSourceReferenceConfigVar,
} from "../types";
import type { CollectionType } from "../types/ConfigVars";
import type { ValidationMode } from "../types/jsonforms/ValidationMode";
import type { AnyDataSource } from ".";

export type { NpmDataSourceReference } from "../types";
export { isNpmDataSourceReference } from "../types";

/**
 * The config-var-level fields accepted alongside the data source's own input values (`values`)
 * when declaring a config var directly from a data source reference — see
 * {@link createCallableDataSource}.
 *
 * `dataSourceType`/`collectionType` are inferred from the data source itself.
 */
export type CallableDataSourceConfigVar = BaseConfigVar & {
  collectionType?: CollectionType;
  values?: NonNullable<ComponentReference["values"]>;
  validationMode?: ValidationMode;
  dataSourceReset?: Omit<DataSourceReset, "dependencies">;
};

/**
 * Wraps an already-converted data source as a callable that directly produces the config var it
 * backs, e.g.:
 *
 * ```ts
 * "Foo Channel Selector": foo.dataSources.selectChannels({
 *   stableKey: "foo-channel",
 *   description: "Choose a Foo Messenger channel",
 *   values: { connection: { configVar: "Foo Connection" } },
 * }),
 * ```
 *
 * Not part of `convertComponent`'s own unconditional behavior — `component()` calls this
 * internally (via `createCallableComponent`), only when its caller opts in via
 * `component(definition, { callable: true })`.
 */
export const createCallableDataSource =
  (dataSource: AnyDataSource, dataSources: Record<string, AnyDataSource>) =>
  ({
    values = {},
    ...configVar
  }: CallableDataSourceConfigVar): NpmDataSourceReferenceConfigVar => ({
    ...configVar,
    dataSource: {
      __npmDataSourceReference: true,
      dataSource,
      values,
      dataSources,
    },
  });
